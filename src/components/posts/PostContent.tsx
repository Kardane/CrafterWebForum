"use client";

import { processMarkdown } from "@/lib/markdown";
import { processAllEmbeds } from "@/lib/embeds";
import { memo, MouseEvent, useEffect, useMemo, useRef } from "react";
import { useImageLightbox } from "@/components/ui/ImageLightboxProvider";
import {
	buildPostMetaChips,
	renderMeta,
	renderPreviewCard,
	shouldHideExternalCardImage,
	type LinkPreviewPayload,
	type PostMetaItemPayload,
} from "@/lib/post-content-hydrator";

interface PostContentProps {
	content: string;
}

interface WindowWithHighlightJs extends Window {
	hljs?: {
		highlightElement: (element: Element) => void;
	};
}

const POST_META_QUERY_CACHE_MAX_ENTRIES = 100;
const postMetaPayloadByQueryKey = new Map<string, PostMetaItemPayload[]>();
const postMetaEtagByQueryKey = new Map<string, string>();

const EXTERNAL_PREVIEW_CACHE_MAX_ENTRIES = 250;
const EXTERNAL_PREVIEW_MAX_CONCURRENT_FETCHES = 4;
const EXTERNAL_PREVIEW_RATE_LIMIT_BACKOFF_MS = 30_000;

const externalPreviewPayloadByUrl = new Map<string, LinkPreviewPayload>();
const externalPreviewInFlightByUrl = new Map<string, Promise<LinkPreviewPayload>>();
const externalPreviewFailureAtByUrl = new Map<string, number>();

let externalPreviewActiveFetches = 0;
const externalPreviewFetchQueue: Array<() => void> = [];

function setQueryCacheEntry<T>(map: Map<string, T>, key: string, value: T, maxEntries = POST_META_QUERY_CACHE_MAX_ENTRIES) {
	if (map.has(key)) {
		map.delete(key);
	}
	map.set(key, value);
	if (map.size > maxEntries) {
		const oldestKey = map.keys().next().value;
		if (oldestKey) {
			map.delete(oldestKey);
		}
	}
}

function acquireExternalPreviewFetchSlot(): Promise<void> {
	if (externalPreviewActiveFetches < EXTERNAL_PREVIEW_MAX_CONCURRENT_FETCHES) {
		externalPreviewActiveFetches += 1;
		return Promise.resolve();
	}
	return new Promise((resolve) => {
		externalPreviewFetchQueue.push(() => {
			externalPreviewActiveFetches += 1;
			resolve();
		});
	});
}

function releaseExternalPreviewFetchSlot() {
	externalPreviewActiveFetches = Math.max(0, externalPreviewActiveFetches - 1);
	const next = externalPreviewFetchQueue.shift();
	if (next) {
		next();
	}
}

async function fetchExternalPreview(previewUrl: string): Promise<LinkPreviewPayload> {
	const cached = externalPreviewPayloadByUrl.get(previewUrl);
	if (cached) {
		return cached;
	}

	const failureAt = externalPreviewFailureAtByUrl.get(previewUrl);
	if (failureAt && Date.now() - failureAt < EXTERNAL_PREVIEW_RATE_LIMIT_BACKOFF_MS) {
		return { chips: ["메타데이터 조회 대기"] };
	}

	const inFlight = externalPreviewInFlightByUrl.get(previewUrl);
	if (inFlight) {
		return inFlight;
	}

	const promise = (async () => {
		await acquireExternalPreviewFetchSlot();
		try {
			const endpoint = `/api/link-preview?url=${encodeURIComponent(previewUrl)}`;
			const response = await fetch(endpoint, {
				cache: "force-cache",
			});
			if (!response.ok) {
				if (response.status === 429) {
					externalPreviewFailureAtByUrl.set(previewUrl, Date.now());
				}
				throw new Error(`Failed to load link preview metadata: ${response.status}`);
			}
			const data = (await response.json()) as { preview?: LinkPreviewPayload };
			const preview = data.preview ?? { chips: ["메타데이터 조회 실패"] };
			setQueryCacheEntry(externalPreviewPayloadByUrl, previewUrl, preview, EXTERNAL_PREVIEW_CACHE_MAX_ENTRIES);
			return preview;
		} finally {
			releaseExternalPreviewFetchSlot();
			externalPreviewInFlightByUrl.delete(previewUrl);
		}
	})();

	externalPreviewInFlightByUrl.set(previewUrl, promise);
	return promise;
}

function normalizePostMetaIds(rawIds: string[]) {
	return Array.from(
		new Set(
			rawIds
				.map((id) => Number.parseInt(id, 10))
				.filter((id) => Number.isInteger(id) && id > 0)
		)
	).sort((a, b) => a - b);
}

function buildPostMetaQueryKey(rawIds: string[]) {
	const normalizedIds = normalizePostMetaIds(rawIds);
	if (normalizedIds.length === 0) {
		return null;
	}
	return normalizedIds.join(",");
}

function collectExternalLinkCardsFromElements(cards: HTMLAnchorElement[]) {
	const cardsByPostId = new Map<string, HTMLAnchorElement[]>();
	const cardsByPreviewUrl = new Map<string, HTMLAnchorElement[]>();

	for (const card of cards) {
		const postId = card.dataset.postId;
		if (postId) {
			const postIdCards = cardsByPostId.get(postId) ?? [];
			postIdCards.push(card);
			cardsByPostId.set(postId, postIdCards);
		}

		const previewUrl = card.dataset.previewUrl;
		if (!previewUrl) {
			continue;
		}
		const previewCards = cardsByPreviewUrl.get(previewUrl) ?? [];
		previewCards.push(card);
		cardsByPreviewUrl.set(previewUrl, previewCards);
	}

	return {
		cardsByPostId,
		cardsByPreviewUrl,
	};
}

function PostContentInner({ content }: PostContentProps) {
	const contentRef = useRef<HTMLDivElement>(null);
	const postCardMetaCacheRef = useRef<Map<string, string[]>>(new Map());
	const externalCardMetaCacheRef = useRef<Map<string, LinkPreviewPayload>>(new Map());
	const { openImage } = useImageLightbox();

	const html = useMemo(() => {
		let rendered = processMarkdown(content);
		rendered = processAllEmbeds(rendered);
		return rendered;
	}, [content]);
	const markup = useMemo(() => ({ __html: html }), [html]);

	useEffect(() => {
		const root = contentRef.current;
		if (!root) {
			return;
		}
		const highlightWindow = window as WindowWithHighlightJs;
		const codeBlocks = root.querySelectorAll("pre code");
		if (highlightWindow.hljs && codeBlocks.length > 0) {
			codeBlocks.forEach((block) => {
				highlightWindow.hljs?.highlightElement(block);
			});
		}
	}, [html]);

	useEffect(() => {
		const root = contentRef.current;
		if (!root) {
			return;
		}
		let isDisposed = false;
		const controller = new AbortController();
		const hydratedCards = new WeakSet<HTMLAnchorElement>();
		const observedCards = new WeakSet<HTMLAnchorElement>();
		const pendingCards = new Set<HTMLAnchorElement>();
		const initialCards = Array.from(root.querySelectorAll<HTMLAnchorElement>(".external-link-card"));
		if (initialCards.length === 0) {
			return;
		}

		const waitForNextFrame = () => new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
		const renderCardsIncrementally = async (
			cards: HTMLAnchorElement[],
			renderer: (card: HTMLAnchorElement) => void,
			chunkSize = 8
		) => {
			for (let start = 0; start < cards.length; start += chunkSize) {
				if (isDisposed) {
					return;
				}
				const end = Math.min(cards.length, start + chunkSize);
				for (let index = start; index < end; index += 1) {
					renderer(cards[index]);
				}
				if (end < cards.length) {
					await waitForNextFrame();
				}
			}
		};
		const hydrateExternalCards = async (cards: HTMLAnchorElement[]) => {
			const cardsToHydrate = cards.filter((card) => !hydratedCards.has(card));
			if (cardsToHydrate.length === 0) {
				return;
			}
			cardsToHydrate.forEach((card) => hydratedCards.add(card));

			const { cardsByPostId, cardsByPreviewUrl } = collectExternalLinkCardsFromElements(cardsToHydrate);
			const postMetaFallback = ["카테고리: 내부링크", "메타데이터 조회 실패"];
			const uncachedPostIds: string[] = [];

			cardsByPostId.forEach((cards, postId) => {
				const cached = postCardMetaCacheRef.current.get(postId);
				if (cached) {
					cards.forEach((card) => renderMeta(card, cached));
					return;
				}
				uncachedPostIds.push(postId);
			});

			if (uncachedPostIds.length > 0) {
				try {
					const queryKey = buildPostMetaQueryKey(uncachedPostIds);
					if (queryKey) {
						const endpoint = `/api/posts/meta?ids=${encodeURIComponent(queryKey)}`;
						const requestHeaders = new Headers();
						const knownEtag = postMetaEtagByQueryKey.get(queryKey);
						if (knownEtag) {
							requestHeaders.set("If-None-Match", knownEtag);
						}

						let items: PostMetaItemPayload[];
						const response = await fetch(endpoint, {
							cache: "force-cache",
							signal: controller.signal,
							headers: requestHeaders,
						});
						if (response.status === 304) {
							const cachedItems = postMetaPayloadByQueryKey.get(queryKey);
							if (cachedItems) {
								items = cachedItems;
							} else {
								const retry = await fetch(endpoint, {
									cache: "force-cache",
									signal: controller.signal,
								});
								if (!retry.ok) {
									throw new Error(`Failed to load post metadata: ${retry.status}`);
								}
								const retryPayload = (await retry.json()) as { items?: PostMetaItemPayload[] };
								items = retryPayload.items ?? [];
								setQueryCacheEntry(postMetaPayloadByQueryKey, queryKey, items);
								const retryEtag = retry.headers.get("etag");
								if (retryEtag) {
									setQueryCacheEntry(postMetaEtagByQueryKey, queryKey, retryEtag);
								}
							}
						} else {
							if (!response.ok) {
								throw new Error(`Failed to load post metadata: ${response.status}`);
							}
							const payload = (await response.json()) as { items?: PostMetaItemPayload[] };
							items = payload.items ?? [];
							setQueryCacheEntry(postMetaPayloadByQueryKey, queryKey, items);
							const responseEtag = response.headers.get("etag");
							if (responseEtag) {
								setQueryCacheEntry(postMetaEtagByQueryKey, queryKey, responseEtag);
							}
						}

						const itemById = new Map(items.map((item) => [String(item.id), item] as const));
						if (!isDisposed) {
							for (const postId of uncachedPostIds) {
								const cards = cardsByPostId.get(postId) ?? [];
								const item = itemById.get(postId);
								const chips = item ? buildPostMetaChips(item) : postMetaFallback;
								postCardMetaCacheRef.current.set(postId, chips);
								await renderCardsIncrementally(cards, (card) => renderMeta(card, chips));
							}
						}
					}
				} catch (error) {
					const fetchError = error as { name?: string };
					if (fetchError.name !== "AbortError") {
						console.error("Failed to hydrate post card metadata:", error);
					}
					if (!isDisposed && fetchError.name !== "AbortError") {
						for (const postId of uncachedPostIds) {
							const cards = cardsByPostId.get(postId) ?? [];
							postCardMetaCacheRef.current.set(postId, postMetaFallback);
							await renderCardsIncrementally(cards, (card) => renderMeta(card, postMetaFallback));
						}
					}
				}
			}

			const uncachedPreviewEntries: Array<[string, HTMLAnchorElement[]]> = [];
			cardsByPreviewUrl.forEach((cards, previewUrl) => {
				const localCached = externalCardMetaCacheRef.current.get(previewUrl);
				if (localCached) {
					cards.forEach((card) => renderPreviewCard(card, localCached));
					return;
				}
				const sharedCached = externalPreviewPayloadByUrl.get(previewUrl);
				if (sharedCached) {
					externalCardMetaCacheRef.current.set(previewUrl, sharedCached);
					cards.forEach((card) => renderPreviewCard(card, sharedCached));
					return;
				}
				uncachedPreviewEntries.push([previewUrl, cards]);
			});

			if (uncachedPreviewEntries.length === 0) {
				return;
			}

			await Promise.all(
				uncachedPreviewEntries.map(async ([previewUrl, cards]) => {
					try {
						const preview = await fetchExternalPreview(previewUrl);
						if (isDisposed) {
							return;
						}
						externalCardMetaCacheRef.current.set(previewUrl, preview);
						await renderCardsIncrementally(cards, (card) => renderPreviewCard(card, preview));
					} catch (error) {
						console.error("Failed to hydrate external link metadata:", error);
						if (isDisposed) {
							return;
						}
						const fallback: LinkPreviewPayload = {
							chips: ["메타데이터 조회 실패"],
						};
						externalCardMetaCacheRef.current.set(previewUrl, fallback);
						await renderCardsIncrementally(cards, (card) => renderPreviewCard(card, fallback));
					}
				})
			);
		};

		const scheduleHydration = () => {
			if (isDisposed || pendingCards.size === 0) {
				return;
			}
			const cards = Array.from(pendingCards);
			pendingCards.clear();
			void hydrateExternalCards(cards);
		};

		const hasExternalCardNode = (node: Node) => {
			if (!(node instanceof Element)) {
				return false;
			}
			return node.matches(".external-link-card") || Boolean(node.querySelector(".external-link-card"));
		};

		const observeCard = (card: HTMLAnchorElement) => {
			if (observedCards.has(card)) {
				return;
			}
			observedCards.add(card);
			if (!intersectionObserver) {
				pendingCards.add(card);
				scheduleHydration();
				return;
			}
			intersectionObserver.observe(card);
		};

		const registerExternalCards = (cards: HTMLAnchorElement[]) => {
			cards.forEach((card) => {
				observeCard(card);
			});
		};

		const intersectionObserver =
			typeof IntersectionObserver === "function"
				? new IntersectionObserver(
						(entries, observer) => {
							const nextCards: HTMLAnchorElement[] = [];
							for (const entry of entries) {
								if (!entry.isIntersecting || !(entry.target instanceof HTMLAnchorElement)) {
									continue;
								}
								nextCards.push(entry.target);
								observer.unobserve(entry.target);
							}
							if (nextCards.length === 0) {
								return;
							}
							nextCards.forEach((card) => pendingCards.add(card));
							scheduleHydration();
						},
						{ rootMargin: "300px 0px" }
				  )
				: null;

		registerExternalCards(initialCards);
		const observer = new MutationObserver((mutations) => {
			const addedCards: HTMLAnchorElement[] = [];
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					if (!hasExternalCardNode(node)) {
						continue;
					}
					if (node instanceof HTMLAnchorElement && node.matches(".external-link-card")) {
						addedCards.push(node);
					}
					if (node instanceof Element) {
						addedCards.push(...Array.from(node.querySelectorAll<HTMLAnchorElement>(".external-link-card")));
					}
				}
			}
			if (addedCards.length > 0) {
				registerExternalCards(addedCards);
			}
		});
		observer.observe(root, { childList: true, subtree: true });

		const handleImageError = (event: Event) => {
			const target = event.target;
			if (!(target instanceof HTMLImageElement)) {
				return;
			}

			const card = target.closest<HTMLAnchorElement>(".external-link-card");
			if (card && target.dataset.fallbackTried !== "1") {
				if (target.classList.contains("external-link-card__thumb")) {
					const icon = card.querySelector<HTMLImageElement>(".external-link-card__icon");
					const fallbackSrc = icon?.currentSrc || icon?.src || "";
					if (fallbackSrc && fallbackSrc !== target.currentSrc && fallbackSrc !== target.src) {
						target.dataset.fallbackTried = "1";
						target.src = fallbackSrc;
						return;
					}
				}

				if (target.classList.contains("external-link-card__icon")) {
					const fallbackCandidates: string[] = [];
					let parsedHostname = "";
					try {
						const href = card.getAttribute("href") ?? "";
						if (href) {
							parsedHostname = new URL(href).hostname;
						}
					} catch {
						parsedHostname = "";
					}
					if (parsedHostname) {
						fallbackCandidates.push(
							`https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsedHostname)}&sz=64`
						);
					}
					fallbackCandidates.push("/img/Crafter.png");

					const fallbackSrc = fallbackCandidates.find(
						(candidate) => candidate && candidate !== target.currentSrc && candidate !== target.src
					);
					if (fallbackSrc) {
						target.dataset.fallbackTried = "1";
						target.src = fallbackSrc;
						return;
					}
				}
			}

			if (shouldHideExternalCardImage(target)) {
				target.style.display = "none";
			}
		};
		root.addEventListener("error", handleImageError, true);

		return () => {
			isDisposed = true;
			controller.abort();
			intersectionObserver?.disconnect();
			observer.disconnect();
			root.removeEventListener("error", handleImageError, true);
		};
	}, [html]);

	const handleImageClick = (event: MouseEvent<HTMLDivElement>) => {
		const target = event.target;
		if (!(target instanceof HTMLImageElement)) {
			return;
		}

		if (!contentRef.current?.contains(target)) {
			return;
		}
		if (target.closest(".external-link-card")) {
			return;
		}
		if (!target.classList.contains("md-image") && !target.closest(".embed-container")) {
			return;
		}

		event.preventDefault();
		openImage({
			src: target.currentSrc || target.src,
			alt: target.alt || "이미지",
		});
	};

	return (
		<>
			<div
				ref={contentRef}
				className="post-content prose prose-invert max-w-none"
				dangerouslySetInnerHTML={markup}
				onClick={handleImageClick}
			/>
		</>
	);
}

const PostContent = memo(PostContentInner, (prevProps, nextProps) => prevProps.content === nextProps.content);

PostContent.displayName = "PostContent";

export default PostContent;
