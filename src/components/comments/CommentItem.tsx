"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Reply, Copy, Link2, Edit, Trash2, Pin, Check, ArrowUpLeft } from "lucide-react";
import PostContent from "../posts/PostContent";
import CommentForm from "./CommentForm";
import PollCard from "@/components/poll/PollCard";
import { extractPollData } from "@/lib/poll";
import { toSessionUserId } from "@/lib/session-user";
import { useToast } from "@/components/ui/useToast";

interface Comment {
	id: number;
	content: string;
	createdAt: string;
	updatedAt: string;
	isPinned: boolean;
	parentId: number | null;
	isPostAuthor: boolean;
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
	replyToName?: string | null;
	replyToCommentId?: number | null;
	onReplyRequest: (commentId: number, nickname: string) => void;
	onNavigateToComment?: (commentId: number) => void;
	onEdit: (commentId: number, content: string) => void;
	onDelete: (commentId: number) => void;
	onPin?: (commentId: number) => void;
	onVote?: (commentId: number, optionId: number) => void;
	disabled?: boolean;
	threadRootId?: number;
	isHighlighted?: boolean;
}

function getMinecraftHeadUrl(uuid: string | null, size = 36): string | null {
	if (!uuid) return null;
	return `https://api.mineatar.io/face/${uuid}?scale=${Math.ceil(size / 8)}`;
}

type CopiedType = "text" | "link" | null;

export default function CommentItem({
	comment,
	replyToName = null,
	replyToCommentId = null,
	onReplyRequest,
	onNavigateToComment,
	onEdit,
	onDelete,
	onPin,
	onVote,
	disabled = false,
	threadRootId,
	isHighlighted = false,
}: CommentItemProps) {
	const { data: session } = useSession();
	const { showToast } = useToast();
	const [isEditing, setIsEditing] = useState(false);
	const [copiedType, setCopiedType] = useState<CopiedType>(null);
	const copiedTimeoutRef = useRef<number | null>(null);

	useEffect(
		() => () => {
			if (copiedTimeoutRef.current) {
				window.clearTimeout(copiedTimeoutRef.current);
			}
		},
		[]
	);

	const sessionUserId = toSessionUserId(session?.user?.id);
	const isOwner = sessionUserId === comment.author.id;
	const isAdmin = (session?.user as { role?: string })?.role === "admin";

	const createdAtLabel = new Date(comment.createdAt).toLocaleString("ko-KR", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
	const fullCreatedAtLabel = new Date(comment.createdAt).toLocaleString("ko-KR");

	const pollData = extractPollData(comment.content);
	const contentWithoutPoll = comment.content.replace(/\[POLL_JSON\][\s\S]*?\[\/POLL_JSON\]/, "").trim();
	const resolvedThreadRootId = threadRootId ?? comment.id;

	const handleEditSubmit = (content: string) => {
		onEdit(comment.id, content);
		setIsEditing(false);
	};

	const markCopied = (type: Exclude<CopiedType, null>) => {
		setCopiedType(type);
		if (copiedTimeoutRef.current) {
			window.clearTimeout(copiedTimeoutRef.current);
		}
		copiedTimeoutRef.current = window.setTimeout(() => {
			setCopiedType(null);
		}, 1200);
	};

	const handleCopyText = async () => {
		try {
			await navigator.clipboard.writeText(comment.content);
			markCopied("text");
			showToast({ type: "success", message: "댓글 내용 복사 완료" });
		} catch (error) {
			console.error("Failed to copy comment text:", error);
			showToast({ type: "error", message: "복사 실패" });
		}
	};

	const handleCopyLink = async () => {
		try {
			const url = `${window.location.origin}${window.location.pathname}#comment-${comment.id}`;
			await navigator.clipboard.writeText(url);
			markCopied("link");
			showToast({ type: "success", message: "댓글 링크 복사 완료" });
		} catch (error) {
			console.error("Failed to copy comment link:", error);
			showToast({ type: "error", message: "복사 실패" });
		}
	};

	const handleReplyContextClick = () => {
		if (replyToCommentId === null || !onNavigateToComment) {
			return;
		}
		onNavigateToComment(replyToCommentId);
	};

	return (
		<div className="comment-wrapper" id={`comment-${comment.id}`}>
			<div className={`comment-item ${comment.isPinned ? "pinned" : ""} ${isHighlighted ? "is-highlighted" : ""}`}>
				<div className="comment-avatar">
					{comment.author.minecraftUuid ? (
						<img
							src={getMinecraftHeadUrl(comment.author.minecraftUuid, 36) || ""}
							alt=""
							className="avatar-img"
						/>
					) : (
						<div className="avatar-fallback">{comment.author.nickname[0].toUpperCase()}</div>
					)}
				</div>

				<div className="comment-content">
					{replyToName && (
						<button type="button" className="comment-reply-context" onClick={handleReplyContextClick}>
							<ArrowUpLeft size={12} />
							<span>@{replyToName}</span>
						</button>
					)}

					<div className="comment-header">
						<span className="comment-author">{comment.author.nickname}</span>
						{comment.isPostAuthor && <span className="comment-badge author">작성자</span>}
						{comment.isPinned && <span className="comment-badge pinned">📌 고정됨</span>}
					</div>

					{isEditing ? (
						<CommentForm
							onSubmit={handleEditSubmit}
							onCancel={() => setIsEditing(false)}
							initialValue={comment.content}
							placeholder="댓글을 수정해줘"
							disabled={disabled}
							mode="edit"
						/>
					) : (
						<>
							{contentWithoutPoll && (
								<div className="comment-content-row">
									<div className="comment-body">
										<PostContent content={contentWithoutPoll} />
									</div>
									<span className="comment-hover-time" title={fullCreatedAtLabel}>
										{createdAtLabel}
										{comment.updatedAt !== comment.createdAt ? " (수정됨)" : ""}
									</span>
								</div>
							)}

							{pollData && (
								<PollCard
									pollData={pollData}
									commentId={comment.id}
									onVote={(optionId) => onVote?.(comment.id, optionId)}
								/>
							)}
						</>
					)}
				</div>

				{!isEditing && (
					<div className="comment-actions">
						<button
							type="button"
							className="action-btn"
							onClick={() => onReplyRequest(resolvedThreadRootId, comment.author.nickname)}
							title="답장"
						>
							<Reply size={16} />
						</button>
						<button type="button" className="action-btn" onClick={handleCopyLink} title="링크 복사">
							{copiedType === "link" ? <Check size={16} /> : <Link2 size={16} />}
						</button>
						<button type="button" className="action-btn" onClick={handleCopyText} title="텍스트 복사">
							{copiedType === "text" ? <Check size={16} /> : <Copy size={16} />}
						</button>
						{(isOwner || isAdmin) && (
							<>
								<button type="button" className="action-btn" onClick={() => setIsEditing(true)} title="수정">
									<Edit size={16} />
								</button>
								<button type="button" className="action-btn danger" onClick={() => onDelete(comment.id)} title="삭제">
									<Trash2 size={16} />
								</button>
							</>
						)}
						{isAdmin && onPin && (
							<button
								type="button"
								className="action-btn"
								onClick={() => onPin(comment.id)}
								title={comment.isPinned ? "고정 해제" : "고정"}
							>
								<Pin size={16} />
							</button>
						)}
					</div>
				)}
			</div>

			<style jsx>{`
				.comment-wrapper {
					margin-bottom: 4px;
				}

				.comment-item {
					display: flex;
					gap: 12px;
					padding: 12px;
					border-radius: 6px;
					position: relative;
					transition: background-color 0.15s;
				}

				.comment-item:hover {
					background: color-mix(in srgb, var(--bg-tertiary) 84%, #000 16%);
				}

				.comment-item.is-highlighted {
					background: color-mix(in srgb, var(--warning) 30%, #000 70%);
					box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 60%, transparent);
					animation: reply-highlight-pulse 1.2s ease;
				}

				.comment-item.pinned {
					background: rgba(139, 35, 50, 0.15);
					border-left: 3px solid var(--accent);
				}

				.comment-item.pinned:hover {
					background: rgba(139, 35, 50, 0.2);
				}

				.comment-avatar {
					flex-shrink: 0;
				}

				.avatar-img {
					width: 36px;
					height: 36px;
					border-radius: 4px;
					image-rendering: pixelated;
				}

				.avatar-fallback {
					width: 36px;
					height: 36px;
					border-radius: 4px;
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

				.comment-badge.author {
					background: #8b2332;
					color: #fff;
				}

				.comment-badge.pinned {
					background: var(--warning);
					color: var(--bg-primary);
				}

				.comment-reply-context {
					display: inline-flex;
					align-items: center;
					gap: 4px;
					width: fit-content;
					margin-bottom: 5px;
					padding: 3px 7px;
					border-radius: 4px;
					font-size: 0.72rem;
					color: color-mix(in srgb, var(--text-secondary) 85%, #fff 15%);
					background: color-mix(in srgb, var(--bg-tertiary) 45%, #000 55%);
					border: 1px solid color-mix(in srgb, var(--border) 65%, #000 35%);
					cursor: pointer;
					transition: background-color 0.15s ease, color 0.15s ease;
				}

				.comment-reply-context:hover {
					background: color-mix(in srgb, var(--bg-tertiary) 25%, #000 75%);
					color: #fff;
				}

				.comment-content-row {
					display: flex;
					align-items: flex-start;
					gap: 8px;
					flex-wrap: wrap;
				}

				.comment-body {
					color: var(--text-secondary);
					font-size: 0.9rem;
					line-height: 1.5;
					max-width: min(100%, 820px);
				}

				.comment-body :global(.post-content) {
					margin: 0;
				}

				.comment-body :global(.post-content .md-image),
				.comment-body :global(.post-content .embed-container) {
					margin-top: 0;
				}

				.comment-hover-time {
					font-size: 0.7rem;
					color: var(--text-muted);
					opacity: 0;
					transition: opacity 0.2s ease;
					user-select: none;
					white-space: nowrap;
					pointer-events: none;
					margin-top: 2px;
				}

				.comment-wrapper:hover .comment-hover-time {
					opacity: 1;
				}

				.comment-actions {
					position: absolute;
					top: 8px;
					right: 8px;
					display: flex;
					gap: 4px;
					background: color-mix(in srgb, var(--bg-primary) 72%, #000 28%);
					border: 1px solid color-mix(in srgb, var(--border) 80%, #000 20%);
					border-radius: 6px;
					padding: 3px;
					box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
					backdrop-filter: blur(4px);
					opacity: 0;
					pointer-events: none;
					transition: opacity 0.15s ease;
				}

				.comment-wrapper:hover .comment-actions,
				.comment-item:focus-within .comment-actions {
					opacity: 1;
					pointer-events: auto;
				}

				.action-btn {
					padding: 6px 7px;
					background: none;
					border: none;
					color: var(--text-muted);
					cursor: pointer;
					border-radius: 4px;
					transition: background 0.2s ease, color 0.15s ease;
				}

				.action-btn:hover {
					background: color-mix(in srgb, var(--bg-primary) 25%, #000 75%);
					color: #fff;
				}

				.action-btn.danger:hover {
					color: var(--error);
				}

				@media (hover: none) {
					.comment-actions {
						opacity: 1;
						pointer-events: auto;
					}
				}

				@keyframes reply-highlight-pulse {
					0% {
						box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 30%, transparent);
					}
					50% {
						box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--warning) 70%, transparent);
					}
					100% {
						box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warning) 30%, transparent);
					}
				}
			`}</style>
		</div>
	);
}
