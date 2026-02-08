"use client";

import { Modal } from "@/components/ui/Modal";

interface MarkdownHelpModalProps {
	isOpen: boolean;
	onClose: () => void;
}

const HELP_CATEGORIES = [
	{
		title: "텍스트 강조",
		items: [
			{ syntax: "# 제목 1", description: "대제목" },
			{ syntax: "## 제목 2", description: "중제목" },
			{ syntax: "### 제목 3", description: "소제목" },
			{ syntax: "**굵게**", description: "글자를 굵게" },
			{ syntax: "*기울임*", description: "글자를 기울임" },
			{ syntax: "~~취소선~~", description: "글자 중간 줄" },
			{ syntax: "`코드`", description: "인라인 코드" },
		],
	},
	{
		title: "리스트 및 인용",
		items: [
			{ syntax: "- 항목", description: "글머리 기호" },
			{ syntax: "1. 항목", description: "순서 리스트" },
			{ syntax: "- [ ] 할 일", description: "체크리스트" },
			{ syntax: "> 인용문", description: "문단 인용" },
			{ syntax: "---", description: "가로 구분선" },
		],
	},
	{
		title: "멀티미디어",
		items: [
			{ syntax: "[링크](URL)", description: "하이퍼링크" },
			{ syntax: "![설명](이미지URL)", description: "이미지 삽입" },
			{ syntax: "```언어\\n코드```", description: "코드 블록" },
		],
	},
];

export default function MarkdownHelpModal({ isOpen, onClose }: MarkdownHelpModalProps) {
	return (
		<Modal isOpen={isOpen} onClose={onClose} title="마크다운 가이드" variant="sidebarLike" size="lg">
			<div className="space-y-8 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
				{HELP_CATEGORIES.map((category) => (
					<div key={category.title} className="space-y-3">
						<h3 className="text-xs font-bold uppercase tracking-wider text-text-muted px-1">
							{category.title}
						</h3>
						<div className="grid grid-cols-2 gap-x-4 gap-y-2">
							{category.items.map((item) => (
								<div
									key={item.syntax}
									className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-bg-secondary/30 px-3 py-2 text-sm transition-colors hover:bg-bg-secondary/50"
								>
									<code className="rounded bg-bg-secondary px-2 py-1 text-xs font-medium text-white">
										{item.syntax}
									</code>
									<span className="text-[11px] text-text-secondary">{item.description}</span>
								</div>
							))}
						</div>
					</div>
				))}
			</div>

			<style jsx>{`
				.custom-scrollbar::-webkit-scrollbar {
					width: 4px;
				}
				.custom-scrollbar::-webkit-scrollbar-track {
					background: transparent;
				}
				.custom-scrollbar::-webkit-scrollbar-thumb {
					background: var(--border);
					border-radius: 10px;
				}
			`}</style>
		</Modal>
	);
}
