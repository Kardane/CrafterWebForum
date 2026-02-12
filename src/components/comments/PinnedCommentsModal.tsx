"use client";

/**
 * 고정 댓글 목록 모달
 */

import { Modal } from "@/components/ui/Modal";

interface PinnedCommentItem {
	id: number;
	authorNickname: string;
	createdAt: string;
	preview: string;
}

interface PinnedCommentsModalProps {
	isOpen: boolean;
	onClose: () => void;
	pinnedComments: PinnedCommentItem[];
	onSelect: (commentId: number) => void;
}

export default function PinnedCommentsModal({
	isOpen,
	onClose,
	pinnedComments,
	onSelect,
}: PinnedCommentsModalProps) {
	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="고정 댓글"
			size="md"
			variant="sidebarLike"
		>
			{pinnedComments.length === 0 ? (
				<p className="text-sm text-text-secondary">고정된 댓글 없음</p>
			) : (
				<ul className="pinned-list">
					{pinnedComments.map((item) => (
						<li key={item.id}>
							<button
								type="button"
								className="pinned-item"
								onClick={() => onSelect(item.id)}
							>
								<div className="pinned-item-meta">
									<span className="pinned-item-author">@{item.authorNickname}</span>
									<span className="pinned-item-date">
										{new Date(item.createdAt).toLocaleString("ko-KR", {
											month: "2-digit",
											day: "2-digit",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
								</div>
								<p className="pinned-item-preview">{item.preview}</p>
							</button>
						</li>
					))}
				</ul>
			)}
		</Modal>
	);
}
