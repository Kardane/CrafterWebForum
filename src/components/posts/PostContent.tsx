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

function setQueryCacheEntry<T>(map: Map<string, T>, key: string, value: T) {
	if (map.has(key)) {
		map.delete(key);
	}
	map.set(key, value);
	if (map.size > POST_META_QUERY_CACHE_MAX_ENTRIES) {
		const oldestKey = map.keys().next().value;
		if (oldestKey) {
			map.delete(oldestKey);
		}
	}
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
			void (async () => {
				try {
					const queryKey = buildPostMetaQueryKey(uncachedPostIds);
					if (!queryKey) {
						return;
					}
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
					if (isDisposed) {
						return;
					}

					for (const postId of uncachedPostIds) {
						const cards = cardsByPostId.get(postId) ?? [];
						const item = itemById.get(postId);
						const chips = item ? buildPostMetaChips(item) : postMetaFallback;
						postCardMetaCacheRef.current.set(postId, chips);
						await renderCardsIncrementally(cards, (card) => renderMeta(card, chips));
					}
				} catch (error) {
					const fetchError = error as { name?: string };
					if (fetchError.name === "AbortError") {
						return;
					}
					console.error("Failed to hydrate post card metadata:", error);
					if (isDisposed) {
						return;
					}
					for (const postId of uncachedPostIds) {
						const cards = cardsByPostId.get(postId) ?? [];
						postCardMetaCacheRef.current.set(postId, postMetaFallback);
						await renderCardsIncrementally(cards, (card) => renderMeta(card, postMetaFallback));
					}
				}
			})();
		}

		const uncachedPreviewEntries: Array<[string, HTMLAnchorElement[]]> = [];
		cardsByPreviewUrl.forEach((cards, previewUrl) => {
			const cached = externalCardMetaCacheRef.current.get(previewUrl);
			if (cached) {
				cards.forEach((card) => renderPreviewCard(card, cached));
				return;
			}
			uncachedPreviewEntries.push([previewUrl, cards]);
		});

		if (uncachedPreviewEntries.length > 0) {
			void (async () => {
				const maxConcurrentFetches = 4;
				for (let index = 0; index < uncachedPreviewEntries.length; index += maxConcurrentFetches) {
					const batch = uncachedPreviewEntries.slice(index, index + maxConcurrentFetches);
					await Promise.all(
						batch.map(async ([previewUrl, cards]) => {
							try {
								const endpoint = `/api/link-preview?url=${encodeURIComponent(previewUrl)}`;
								const response = await fetch(endpoint, {
									cache: "force-cache",
									signal: controller.signal,
								});
								if (!response.ok) {
									throw new Error(`Failed to load link preview metadata: ${response.status}`);
								}
								const data = (await response.json()) as { preview?: LinkPreviewPayload };
								if (!data.preview || isDisposed) {
									return;
								}
								externalCardMetaCacheRef.current.set(previewUrl, data.preview);
								await renderCardsIncrementally(
									cards,
									(card) => renderPreviewCard(card, data.preview as LinkPreviewPayload)
								);
							} catch (error) {
								const fetchError = error as { name?: string };
								if (fetchError.name === "AbortError") {
									return;
								}
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
					if (isDisposed) {
						return;
					}
				}
			})();
		}

		const handleImageError = (event: Event) => {
			const target = event.target;
			if (!(target instanceof HTMLImageElement)) {
				return;
			}
			if (shouldHideExternalCardImage(target)) {
				target.style.display = "none";
			}
		};
		root.addEventListener("error", handleImageError, true);

		return () => {
			isDisposed = true;
			controller.abort();
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
