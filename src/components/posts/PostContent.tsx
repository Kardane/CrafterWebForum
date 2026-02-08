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
	const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);

	useEffect(() => {
		const highlightWindow = window as WindowWithHighlightJs;
		if (highlightWindow.hljs) {
			contentRef.current?.querySelectorAll("pre code").forEach((block) => {
				highlightWindow.hljs?.highlightElement(block);
			});
		}
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
