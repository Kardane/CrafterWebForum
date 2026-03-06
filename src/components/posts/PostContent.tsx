"use client";

import { processMarkdown } from "@/lib/markdown";
import { processAllEmbeds } from "@/lib/embeds";
import { MouseEvent, useEffect, useMemo, useRef } from "react";
import { useImageLightbox } from "@/components/ui/ImageLightboxProvider";
import {
	buildPostMetaChips,
	collectExternalLinkCards,
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

export default function PostContent({ content }: PostContentProps) {
	const contentRef = useRef<HTMLDivElement>(null);
	const postCardMetaCacheRef = useRef<Map<string, string[]>>(new Map());
	const externalCardMetaCacheRef = useRef<Map<string, LinkPreviewPayload>>(new Map());
	const { openImage } = useImageLightbox();

	const html = useMemo(() => {
		let rendered = processMarkdown(content);
		rendered = processAllEmbeds(rendered);
		return rendered;
	}, [content]);

	useEffect(() => {
		const highlightWindow = window as WindowWithHighlightJs;
		if (highlightWindow.hljs) {
			contentRef.current?.querySelectorAll("pre code").forEach((block) => {
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
		let hydrationQueued = false;
		let hydrationInFlight = false;
		const controller = new AbortController();
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
		const hydrateExternalCards = async () => {
			const { cardsByPostId, cardsByPreviewUrl } = collectExternalLinkCards(root);
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
			if (isDisposed || hydrationQueued) {
				return;
			}
			hydrationQueued = true;
			window.requestAnimationFrame(() => {
				hydrationQueued = false;
				if (isDisposed || hydrationInFlight) {
					return;
				}
				hydrationInFlight = true;
				void hydrateExternalCards().finally(() => {
					hydrationInFlight = false;
				});
			});
		};

		const hasExternalCardNode = (node: Node) => {
			if (!(node instanceof Element)) {
				return false;
			}
			return node.matches(".external-link-card") || Boolean(node.querySelector(".external-link-card"));
		};

		scheduleHydration();
		const observer = new MutationObserver((mutations) => {
			if (
				mutations.some((mutation) =>
					Array.from(mutation.addedNodes).some(hasExternalCardNode) ||
					Array.from(mutation.removedNodes).some(hasExternalCardNode)
				)
			) {
				scheduleHydration();
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
				dangerouslySetInnerHTML={{ __html: html }}
				onClick={handleImageClick}
			/>
		</>
	);
}
