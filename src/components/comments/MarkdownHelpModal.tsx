"use client";

import { Modal } from "@/components/ui/Modal";

interface MarkdownHelpModalProps {
	isOpen: boolean;
	onClose: () => void;
}

const HELP_ITEMS: Array<{ syntax: string; description: string }> = [
	{ syntax: "**굵게**", description: "굵게" },
	{ syntax: "*기울임*", description: "기울임" },
	{ syntax: "~~취소선~~", description: "취소선" },
	{ syntax: "`코드`", description: "인라인 코드" },
	{ syntax: "[링크](url)", description: "하이퍼링크" },
	{ syntax: "![설명](이미지URL)", description: "이미지" },
	{ syntax: "```언어\\n코드```", description: "코드 블록" },
];

export default function MarkdownHelpModal({ isOpen, onClose }: MarkdownHelpModalProps) {
	return (
		<Modal isOpen={isOpen} onClose={onClose} title="마크다운 도움말" variant="sidebarLike" size="md">
			<div className="space-y-2">
				{HELP_ITEMS.map((item) => (
					<div
						key={item.syntax}
						className="flex items-center justify-between gap-4 rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm"
					>
						<code className="rounded bg-bg-secondary px-2 py-1 text-xs text-text-primary">{item.syntax}</code>
						<span className="text-text-secondary">{item.description}</span>
					</div>
				))}
			</div>
		</Modal>
	);
}
