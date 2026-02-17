"use client";

import { processMarkdown } from "@/lib/markdown";
import { processAllEmbeds } from "@/lib/embeds";
import { MouseEvent, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import SafeImage from "@/components/ui/SafeImage";

interface PostContentProps {
	content: string;
}

interface WindowWithHighlightJs extends Window {
	hljs?: {
		highlightElement: (element: Element) => void;
	};
}

interface LinkPreviewPayload {
	badge?: string;
	title?: string;
	subtitle?: string;
	description?: string;
	imageUrl?: string;
	iconUrl?: string;
	authorName?: string;
	authorAvatarUrl?: string;
	status?: string;
	chips?: string[];
	metrics?: string[];
}

interface PostMetaItemPayload {
	id: number;
	category: string;
	views: number;
	likes: number;
	comments: number;
}

export default function PostContent({ content }: PostContentProps) {
	const contentRef = useRef<HTMLDivElement>(null);
	const postCardMetaCacheRef = useRef<Map<string, string[]>>(new Map());
	const externalCardMetaCacheRef = useRef<Map<string, LinkPreviewPayload>>(new Map());
	const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

	useEffect(() => {
		const highlightWindow = window as WindowWithHighlightJs;
		if (highlightWindow.hljs) {
			contentRef.current?.querySelectorAll("pre code").forEach((block) => {
				highlightWindow.hljs?.highlightElement(block);
			});
		}
	}, [content]);

	useEffect(() => {
		const root = contentRef.current;
		if (!root) {
			return;
		}
		let isDisposed = false;
		const controller = new AbortController();

		const cardsByPostId = new Map<string, HTMLAnchorElement[]>();
		root.querySelectorAll<HTMLAnchorElement>(".external-link-card[data-post-id]").forEach((card) => {
			const postId = card.dataset.postId;
			if (!postId) {
				return;
			}
			const list = cardsByPostId.get(postId) ?? [];
			list.push(card);
			cardsByPostId.set(postId, list);
		});
		const cardsByPreviewUrl = new Map<string, HTMLAnchorElement[]>();
		root.querySelectorAll<HTMLAnchorElement>(".external-link-card[data-preview-url]").forEach((card) => {
			const previewUrl = card.dataset.previewUrl;
			if (!previewUrl) {
				return;
			}
			const list = cardsByPreviewUrl.get(previewUrl) ?? [];
			list.push(card);
			cardsByPreviewUrl.set(previewUrl, list);
		});

		const ensureCardBody = (card: HTMLAnchorElement) => {
			return card.querySelector<HTMLSpanElement>(".external-link-card__body") ?? card;
		};

		const renderMeta = (card: HTMLAnchorElement, chips: string[]) => {
			const body = ensureCardBody(card);
			let metaContainer = body.querySelector<HTMLDivElement>(".external-link-card__meta");
			if (!metaContainer) {
				metaContainer = document.createElement("div");
				metaContainer.className = "external-link-card__meta";
				body.appendChild(metaContainer);
			}
			metaContainer.innerHTML = "";
			chips.forEach((chip) => {
				const chipNode = document.createElement("span");
				chipNode.className = "external-link-card__meta-chip";
				chipNode.textContent = chip;
				metaContainer?.appendChild(chipNode);
			});
		};
		const renderStatus = (card: HTMLAnchorElement, status?: string) => {
			const body = ensureCardBody(card);
			const existing = body.querySelector<HTMLSpanElement>(".external-link-card__status");
			if (!status) {
				existing?.remove();
				return;
			}
			const statusNode = existing ?? document.createElement("span");
			statusNode.className = "external-link-card__status";
			statusNode.textContent = status;
			if (!existing) {
				body.appendChild(statusNode);
			}
		};
		const renderAuthor = (card: HTMLAnchorElement, authorName?: string, authorAvatarUrl?: string) => {
			const body = ensureCardBody(card);
			const existing = body.querySelector<HTMLSpanElement>(".external-link-card__author");
			if (!authorName && !authorAvatarUrl) {
				existing?.remove();
				return;
			}
			const authorNode = existing ?? document.createElement("span");
			authorNode.className = "external-link-card__author";
			authorNode.innerHTML = "";

			if (authorAvatarUrl) {
				const avatar = document.createElement("img");
				avatar.src = authorAvatarUrl;
				avatar.alt = "";
				avatar.className = "external-link-card__author-avatar";
				avatar.loading = "lazy";
				avatar.decoding = "async";
				authorNode.appendChild(avatar);
			}

			if (authorName) {
				const name = document.createElement("span");
				name.className = "external-link-card__author-name";
				name.textContent = authorName;
				authorNode.appendChild(name);
			}

			if (!existing) {
				body.appendChild(authorNode);
			}
		};
		const renderPreviewCard = (card: HTMLAnchorElement, preview: LinkPreviewPayload) => {
			const body = ensureCardBody(card);
			const badgeNode = card.querySelector<HTMLElement>(".external-link-card__badge");
			if (badgeNode && preview.badge) {
				badgeNode.textContent = preview.badge;
			}

			const titleNode = card.querySelector<HTMLElement>(".external-link-card__title");
			if (titleNode && preview.title) {
				titleNode.textContent = preview.title;
			}

			const subtitleNode = card.querySelector<HTMLElement>(".external-link-card__subtitle");
			if (subtitleNode) {
				subtitleNode.textContent = preview.subtitle || subtitleNode.textContent || "";
			}
			const existingDescription = body.querySelector<HTMLElement>(".external-link-card__description");
			if (preview.description) {
				const descriptionNode = existingDescription ?? document.createElement("span");
				descriptionNode.className = "external-link-card__description";
				descriptionNode.textContent = preview.description;
				if (!existingDescription) {
					body.appendChild(descriptionNode);
				}
			} else {
				existingDescription?.remove();
			}

			const thumbnailNode = card.querySelector<HTMLImageElement>(".external-link-card__thumb");
			const iconNode = card.querySelector<HTMLImageElement>(".external-link-card__icon");
			const mediaImageUrl = preview.imageUrl || preview.authorAvatarUrl || preview.iconUrl;
			if (thumbnailNode && mediaImageUrl) {
				thumbnailNode.src = mediaImageUrl;
			}
			if (iconNode && preview.iconUrl) {
				iconNode.src = preview.iconUrl;
			}

			renderAuthor(card, preview.authorName, preview.authorAvatarUrl);
			renderStatus(card, preview.status);
			const chips = [...(preview.metrics ?? []), ...(preview.chips ?? [])];
			renderMeta(card, chips);
		};

		const buildPostMetaChips = (item: PostMetaItemPayload) => {
			return [
				`카테고리: ${item.category || "일반"}`,
				`조회 ${item.views ?? 0}`,
				`추천 ${item.likes ?? 0}`,
				`댓글 ${item.comments ?? 0}`,
			];
		};

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
					const endpoint = `/api/posts/meta?ids=${encodeURIComponent(uncachedPostIds.join(","))}`;
					const response = await fetch(endpoint, {
						cache: "force-cache",
						signal: controller.signal,
					});
					if (!response.ok) {
						throw new Error(`Failed to load post metadata: ${response.status}`);
					}

					const payload = (await response.json()) as { items?: PostMetaItemPayload[] };
					const itemById = new Map(
						(payload.items ?? []).map((item) => [String(item.id), item] as const)
					);
					if (isDisposed) {
						return;
					}

					uncachedPostIds.forEach((postId) => {
						const cards = cardsByPostId.get(postId) ?? [];
						const item = itemById.get(postId);
						const chips = item ? buildPostMetaChips(item) : postMetaFallback;
						postCardMetaCacheRef.current.set(postId, chips);
						cards.forEach((card) => renderMeta(card, chips));
					});
				} catch (error) {
					const fetchError = error as { name?: string };
					if (fetchError.name === "AbortError") {
						return;
					}
					console.error("Failed to hydrate post card metadata:", error);
					if (isDisposed) {
						return;
					}
					uncachedPostIds.forEach((postId) => {
						const cards = cardsByPostId.get(postId) ?? [];
						postCardMetaCacheRef.current.set(postId, postMetaFallback);
						cards.forEach((card) => renderMeta(card, postMetaFallback));
					});
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
								cards.forEach((card) => renderPreviewCard(card, data.preview as LinkPreviewPayload));
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
								cards.forEach((card) => renderPreviewCard(card, fallback));
							}
						})
					);
					if (isDisposed) {
						return;
					}
				}
			})();
		}

		// 이미지 에러 핸들링
		root.querySelectorAll("img").forEach((img) => {
			img.onerror = () => {
				// 이미지가 링크 카드 내부의 것인지 확인
				if (img.closest(".external-link-card")) {
					// 썸네일이나 아이콘이면 숨김 처리
					if (img.classList.contains("external-link-card__thumb") || img.classList.contains("external-link-card__icon")) {
						img.style.display = "none";
					}
					// 작성자 아바타면 기본 아이콘으로 대체하거나 숨김
					if (img.classList.contains("external-link-card__author-avatar")) {
						img.style.display = "none";
					}
				}
			};
		});

		return () => {
			isDisposed = true;
			controller.abort();
		};
	}, [content]);

	let html = processMarkdown(content);
	html = processAllEmbeds(html);

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
		setSelectedImage({
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

			<Modal
				isOpen={selectedImage !== null}
				onClose={() => setSelectedImage(null)}
				hideCloseButton
				size="xl"
				variant="sidebarLike"
				className="!max-w-[96vw] !border-none !bg-transparent !shadow-none"
				bodyClassName="!overflow-visible !p-0"
			>
				{selectedImage && (
					<div className="relative h-[82vh] w-[96vw] max-w-[1440px]">
						<SafeImage
							src={selectedImage.src}
							alt={selectedImage.alt}
							fill
							sizes="96vw"
							className="object-contain"
						/>
					</div>
				)}
			</Modal>
		</>
	);
}
