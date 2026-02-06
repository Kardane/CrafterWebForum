"use client";

import { processMarkdown } from "@/lib/markdown";
import { processAllEmbeds } from "@/lib/embeds";
import { useEffect, useRef } from "react";

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

	return (
		<div
			ref={contentRef}
			className="post-content prose prose-invert max-w-none"
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
