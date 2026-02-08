"use client";

import { processMarkdown } from "@/lib/markdown";
import { processAllEmbeds } from "@/lib/embeds";
import { MouseEvent, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";

interface PostContentProps {
	content: string;
}

interface WindowWithHighlightJs extends Window {
	hljs?: {
		highlightElement: (element: Element) => void;
	};
}

export default function PostContent({ content }: PostContentProps) {
	const contentRef = useRef<HTMLDivElement>(null);
	const postCardMetaCacheRef = useRef<Map<string, string[]>>(new Map());
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

		const renderMeta = (card: HTMLAnchorElement, chips: string[]) => {
			let metaContainer = card.querySelector<HTMLDivElement>(".external-link-card__meta");
			if (!metaContainer) {
				metaContainer = document.createElement("div");
				metaContainer.className = "external-link-card__meta";
				card.appendChild(metaContainer);
			}
			metaContainer.innerHTML = "";
			chips.forEach((chip) => {
				const chipNode = document.createElement("span");
				chipNode.className = "external-link-card__meta-chip";
				chipNode.textContent = chip;
				metaContainer?.appendChild(chipNode);
			});
		};

		const countComments = (nodes: Array<{ replies?: unknown[] }>): number =>
			nodes.reduce((sum, node) => {
				const replyNodes = Array.isArray(node.replies)
					? (node.replies as Array<{ replies?: unknown[] }>)
					: [];
				return sum + 1 + countComments(replyNodes);
			}, 0);

		cardsByPostId.forEach((cards, postId) => {
			const cached = postCardMetaCacheRef.current.get(postId);
			if (cached) {
				cards.forEach((card) => renderMeta(card, cached));
				return;
			}

			void (async () => {
				try {
					const response = await fetch(`/api/posts/${postId}`, { cache: "no-store" });
					if (!response.ok) {
						throw new Error(`Failed to load post metadata: ${response.status}`);
					}
					const data = (await response.json()) as {
						post?: { views: number; likes: number; tags?: string[] };
						comments?: Array<{ replies?: unknown[] }>;
					};
					const post = data.post;
					if (!post) {
						return;
					}

					const commentsCount = Array.isArray(data.comments) ? countComments(data.comments) : 0;
					const firstTag = Array.isArray(post.tags) && post.tags.length > 0 ? post.tags[0] : "일반";
					const chips = [
						`카테고리: ${firstTag}`,
						`조회 ${post.views ?? 0}`,
						`추천 ${post.likes ?? 0}`,
						`댓글 ${commentsCount}`,
					];
					postCardMetaCacheRef.current.set(postId, chips);
					cards.forEach((card) => renderMeta(card, chips));
				} catch (error) {
					console.error("Failed to hydrate post card metadata:", error);
					const chips = ["카테고리: 내부링크", "메타데이터 조회 실패"];
					postCardMetaCacheRef.current.set(postId, chips);
					cards.forEach((card) => renderMeta(card, chips));
				}
			})();
		});
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
				title="이미지 미리보기"
				size="xl"
				variant="sidebarLike"
				bodyClassName="p-3"
			>
				{selectedImage && (
					<div className="flex items-center justify-center max-h-[70vh]">
						<img
							src={selectedImage.src}
							alt={selectedImage.alt}
							className="max-h-[68vh] w-auto max-w-full rounded-md object-contain"
						/>
					</div>
				)}
			</Modal>
		</>
	);
}
