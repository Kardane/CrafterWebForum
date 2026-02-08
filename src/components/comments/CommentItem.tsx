"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Reply, Copy, Link2, Edit, Trash2, Pin, MoreHorizontal } from "lucide-react";
import PostContent from "../posts/PostContent";
import CommentForm from "./CommentForm";
import PollCard from "@/components/poll/PollCard";
import { extractPollData, hasPoll, PollData } from "@/lib/poll";

interface Comment {
	id: number;
	content: string;
	createdAt: string;
	updatedAt: string;
	isPinned: boolean;
	parentId: number | null;
	author: {
		id: number;
		nickname: string;
		minecraftUuid: string | null;
		role: string;
	};
	replies: Comment[];
}

interface CommentItemProps {
	comment: Comment;
	onReply: (content: string) => void;
	onEdit: (commentId: number, content: string) => void;
	onDelete: (commentId: number) => void;
	onPin?: (commentId: number) => void;
	onVote?: (commentId: number, optionId: number) => void;
	disabled?: boolean;
	isContinuation?: boolean;
}

/**
 * 마인크래프트 헤드 이미지 URL
 */
function getMinecraftHeadUrl(uuid: string | null, size = 36): string | null {
	if (!uuid) return null;
	return `https://api.mineatar.io/face/${uuid}?scale=${Math.ceil(size / 8)}`;
}

/**
 * 댓글 아이템 컴포넌트 - 레거시 스타일
 * - 36px 원형 아바타
 * - 고정 댓글 배경색
 * - 호버 액션 버튼
 */
export default function CommentItem({
	comment,
	onReply,
	onEdit,
	onDelete,
	onPin,
	onVote,
	disabled = false,
	isContinuation = false
}: CommentItemProps) {
	const { data: session } = useSession();
	const [isReplying, setIsReplying] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [showActions, setShowActions] = useState(false);

	const isOwner = session?.user?.id === comment.author.id;
	const isAdmin = (session?.user as { role?: string })?.role === "admin";

	// 투표 데이터 추출
	const pollData = extractPollData(comment.content);
	const contentWithoutPoll = comment.content.replace(
		/\[POLL_JSON\][\s\S]*?\[\/POLL_JSON\]/,
		""
	).trim();

	// 답장 제출
	const handleReplySubmit = (content: string) => {
		onReply(content);
		setIsReplying(false);
	};

	// 수정 제출
	const handleEditSubmit = (content: string) => {
		onEdit(comment.id, content);
		setIsEditing(false);
	};

	// 텍스트 복사
	const handleCopyText = () => {
		navigator.clipboard.writeText(comment.content);
		alert("내용이 복사되었습니다");
	};

	// 링크 복사
	const handleCopyLink = () => {
		const url = `${window.location.origin}${window.location.pathname}#comment-${comment.id}`;
		navigator.clipboard.writeText(url);
		alert("링크가 복사되었습니다");
	};

	return (
		<div className="comment-wrapper" id={`comment-${comment.id}`}>
			<div
				className={`comment-item ${comment.isPinned ? "pinned" : ""} ${isContinuation ? "continuation" : ""}`}
				onMouseEnter={() => setShowActions(true)}
				onMouseLeave={() => setShowActions(false)}
			>
				{/* 아바타 (연속 댓글이 아닐 때만 표시) */}
				{!isContinuation && (
					<div className="comment-avatar">
						{comment.author.minecraftUuid ? (
							<img
								src={getMinecraftHeadUrl(comment.author.minecraftUuid, 36) || ""}
								alt=""
								className="avatar-img"
							/>
						) : (
							<div className="avatar-fallback">
								{comment.author.nickname[0].toUpperCase()}
							</div>
						)}
					</div>
				)}

				{/* 콘텐츠 영역 */}
				<div className={`comment-content ${isContinuation ? "continuation-content" : ""}`}>
					{/* 작성자 정보 (연속 댓글이 아닐 때만 표시) */}
					{!isContinuation && (
						<div className="comment-header">
							<span className="comment-author">{comment.author.nickname}</span>
							{comment.author.role === "admin" && (
								<span className="comment-badge admin">관리자</span>
							)}
							{comment.isPinned && (
								<span className="comment-badge pinned">📌 고정됨</span>
							)}
							<span className="comment-time">
								{new Date(comment.createdAt).toLocaleString("ko-KR")}
								{comment.updatedAt !== comment.createdAt && " (수정됨)"}
							</span>
						</div>
					)}

					{/* 수정 모드 */}
					{isEditing ? (
						<CommentForm
							onSubmit={handleEditSubmit}
							onCancel={() => setIsEditing(false)}
							initialValue={comment.content}
							placeholder="댓글을 수정하세요..."
							disabled={disabled}
						/>
					) : (
						<>
							{/* 댓글 내용 */}
							{contentWithoutPoll && (
								<div className="comment-body">
									<PostContent content={contentWithoutPoll} />
								</div>
							)}

							{/* 투표 카드 */}
							{pollData && (
								<PollCard
									pollData={pollData}
									commentId={comment.id}
									onVote={(optionId) => onVote?.(comment.id, optionId)}
								/>
							)}
						</>
					)}

					{/* 답장 버튼 (편집 중이 아닐 때) */}
					{!isEditing && !comment.parentId && (
						<button
							onClick={() => setIsReplying(!isReplying)}
							disabled={disabled}
							className="reply-btn"
						>
							답장
						</button>
					)}
				</div>

				{/* 호버 액션 버튼 */}
				{showActions && !isEditing && (
					<div className="comment-actions">
						<button
							className="action-btn"
							onClick={() => setIsReplying(!isReplying)}
							title="답장"
						>
							<Reply size={14} />
						</button>
						<button className="action-btn" onClick={handleCopyLink} title="링크 복사">
							<Link2 size={14} />
						</button>
						<button className="action-btn" onClick={handleCopyText} title="텍스트 복사">
							<Copy size={14} />
						</button>
						{(isOwner || isAdmin) && (
							<>
								<button
									className="action-btn"
									onClick={() => setIsEditing(true)}
									title="수정"
								>
									<Edit size={14} />
								</button>
								<button
									className="action-btn danger"
									onClick={() => onDelete(comment.id)}
									title="삭제"
								>
									<Trash2 size={14} />
								</button>
							</>
						)}
						{isAdmin && onPin && (
							<button
								className="action-btn"
								onClick={() => onPin(comment.id)}
								title={comment.isPinned ? "고정 해제" : "고정"}
							>
								<Pin size={14} />
							</button>
						)}
					</div>
				)}
			</div>

			{/* 답장 폼 */}
			{isReplying && (
				<div className="reply-form-wrapper">
					<CommentForm
						onSubmit={handleReplySubmit}
						onCancel={() => setIsReplying(false)}
						placeholder="답장을 입력하세요..."
						replyTo={comment.author.nickname}
						disabled={disabled}
					/>
				</div>
			)}

			{/* 대댓글 목록 */}
			{comment.replies && comment.replies.length > 0 && (
				<div className="replies-wrapper">
					{comment.replies.map((reply) => (
						<CommentItem
							key={reply.id}
							comment={reply}
							onReply={onReply}
							onEdit={onEdit}
							onDelete={onDelete}
							onPin={onPin}
							onVote={onVote}
							disabled={disabled}
						/>
					))}
				</div>
			)}

			{/* 스타일 */}
			<style jsx>{`
				.comment-wrapper {
					margin-bottom: 4px;
				}

				.comment-item {
					display: flex;
					gap: 12px;
					padding: 12px;
					border-radius: 4px;
					position: relative;
					transition: background-color 0.15s;
				}

				.comment-item:hover {
					background: var(--bg-tertiary);
				}

				.comment-item.pinned {
					background: rgba(139, 35, 50, 0.15);
					border-left: 3px solid var(--accent);
				}

				.comment-item.pinned:hover {
					background: rgba(139, 35, 50, 0.2);
				}

				.comment-item.continuation {
					padding-top: 4px;
				}

				.comment-avatar {
					flex-shrink: 0;
				}

				.avatar-img {
					width: 36px;
					height: 36px;
					border-radius: 50%;
					image-rendering: pixelated;
				}

				.avatar-fallback {
					width: 36px;
					height: 36px;
					border-radius: 50%;
					background: var(--bg-tertiary);
					display: flex;
					align-items: center;
					justify-content: center;
					font-weight: 600;
					color: var(--text-muted);
				}

				.comment-content {
					flex: 1;
					min-width: 0;
				}

				.continuation-content {
					margin-left: 48px;
				}

				.comment-header {
					display: flex;
					align-items: center;
					flex-wrap: wrap;
					gap: 8px;
					margin-bottom: 4px;
				}

				.comment-author {
					font-weight: 600;
					color: var(--text-primary);
				}

				.comment-badge {
					font-size: 0.7rem;
					padding: 2px 6px;
					border-radius: 4px;
				}

				.comment-badge.admin {
					background: var(--accent);
					color: white;
				}

				.comment-badge.pinned {
					background: var(--warning);
					color: var(--bg-primary);
				}

				.comment-time {
					font-size: 0.75rem;
					color: var(--text-muted);
				}

				.comment-body {
					color: var(--text-secondary);
					font-size: 0.9rem;
					line-height: 1.5;
				}

				.reply-btn {
					margin-top: 6px;
					padding: 0;
					background: none;
					border: none;
					color: var(--accent);
					font-size: 0.8rem;
					cursor: pointer;
				}

				.reply-btn:hover {
					text-decoration: underline;
				}

				.comment-actions {
					position: absolute;
					top: 8px;
					right: 8px;
					display: flex;
					gap: 2px;
					background: var(--bg-secondary);
					border: 1px solid var(--border);
					border-radius: 4px;
					padding: 2px;
				}

				.action-btn {
					padding: 4px 6px;
					background: none;
					border: none;
					color: var(--text-muted);
					cursor: pointer;
					border-radius: 2px;
				}

				.action-btn:hover {
					background: var(--bg-tertiary);
					color: var(--text-primary);
				}

				.action-btn.danger:hover {
					color: var(--error);
				}

				.reply-form-wrapper {
					margin-left: 48px;
					margin-top: 8px;
				}

				.replies-wrapper {
					margin-left: 48px;
					padding-left: 12px;
					border-left: 2px solid var(--border);
				}
			`}</style>
		</div>
	);
}
