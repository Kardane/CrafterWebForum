"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Reply, Copy, Link2, Edit, Trash2, Pin, Check } from "lucide-react";
import PostContent from "../posts/PostContent";
import CommentForm from "./CommentForm";
import PollCard from "@/components/poll/PollCard";
import SafeImage from "@/components/ui/SafeImage";
import { extractPollData } from "@/lib/poll";
import { toSessionUserId } from "@/lib/session-user";
import { useToast } from "@/components/ui/useToast";
import { buildAvatarCandidates } from "@/lib/avatar";
import { toReplyPreview } from "@/lib/comment-stream";

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
	replyToPreview?: string | null;
	onReplyRequest: (commentId: number, nickname: string, preview: string) => void;
	onNavigateToComment?: (commentId: number) => void;
	onEdit: (commentId: number, content: string) => void;
	onDelete: (commentId: number, event?: React.MouseEvent) => void;
	onPin?: (commentId: number) => void;
	onVote?: (commentId: number, optionId: number) => void;
	shouldStartEdit?: boolean;
	onEditRequestConsumed?: (commentId: number) => void;
	disabled?: boolean;
	threadRootId?: number;
	isCompact?: boolean;
	isHighlighted?: boolean;
	isMentionHighlighted?: boolean;
}

type CopiedType = "text" | "link" | null;

export default function CommentItem({
	comment,
	replyToName = null,
	replyToCommentId = null,
	replyToPreview = null,
	onReplyRequest,
	onNavigateToComment,
	onEdit,
	onDelete,
	onPin,
	onVote,
	shouldStartEdit = false,
	onEditRequestConsumed,
	disabled = false,
	threadRootId,
	isCompact = false,
	isHighlighted = false,
	isMentionHighlighted = false,
}: CommentItemProps) {
	const { data: session } = useSession();
	const { showToast } = useToast();
	const [isEditing, setIsEditing] = useState(false);
	const [copiedType, setCopiedType] = useState<CopiedType>(null);
	const [isActionSuppressed, setIsActionSuppressed] = useState(false);
	const avatarSeed = comment.author.minecraftUuid ?? "";
	const avatarCandidates = useMemo(() => buildAvatarCandidates(comment.author.minecraftUuid, 36), [comment.author.minecraftUuid]);
	const [avatarState, setAvatarState] = useState<{ seed: string; index: number }>({
		seed: avatarSeed,
		index: 0,
	});
	const copiedTimeoutRef = useRef<number | null>(null);
	const suppressTimeoutRef = useRef<number | null>(null);

	useEffect(
		() => () => {
			if (copiedTimeoutRef.current) {
				window.clearTimeout(copiedTimeoutRef.current);
			}
			if (suppressTimeoutRef.current) {
				window.clearTimeout(suppressTimeoutRef.current);
			}
		},
		[]
	);

	useEffect(() => {
		if (!shouldStartEdit) {
			return;
		}
		setIsEditing(true);
		onEditRequestConsumed?.(comment.id);
	}, [comment.id, onEditRequestConsumed, shouldStartEdit]);

	const sessionUserId = toSessionUserId(session?.user?.id);
	const isOwner = sessionUserId === comment.author.id;
	const isAdmin = (session?.user as { role?: string })?.role === "admin";
	const avatarIndex = avatarState.seed === avatarSeed ? avatarState.index : 0;
	const avatarSrc = avatarCandidates[avatarIndex] ?? null;

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
	const replyPreviewForComposer = useMemo(() => {
		const target = contentWithoutPoll || comment.content;
		return toReplyPreview(target);
	}, [comment.content, contentWithoutPoll]);

	const dismissToolbarFocus = () => {
		setIsActionSuppressed(true);
		const active = document.activeElement;
		if (active instanceof HTMLElement && active.closest(`#comment-${comment.id}`)) {
			active.blur();
		}
		const selection = window.getSelection();
		if (selection && selection.rangeCount > 0) {
			selection.removeAllRanges();
		}
		if (suppressTimeoutRef.current) {
			window.clearTimeout(suppressTimeoutRef.current);
		}
		suppressTimeoutRef.current = window.setTimeout(() => {
			setIsActionSuppressed(false);
		}, 700);
	};

	const handleEditSubmit = (content: string) => {
		if (!content.trim()) {
			onDelete(comment.id);
			setIsEditing(false);
			return;
		}
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
		} catch {
			showToast({ type: "error", message: "복사 실패" });
		} finally {
			dismissToolbarFocus();
		}
	};

	const handleCopyLink = async () => {
		try {
			const url = `${window.location.origin}${window.location.pathname}#comment-${comment.id}`;
			await navigator.clipboard.writeText(url);
			markCopied("link");
			showToast({ type: "success", message: "댓글 링크 복사 완료" });
		} catch {
			showToast({ type: "error", message: "복사 실패" });
		} finally {
			dismissToolbarFocus();
		}
	};

	const handleReplyContextClick = () => {
		if (replyToCommentId === null || !onNavigateToComment) {
			return;
		}
		onNavigateToComment(replyToCommentId);
	};

	return (
		<div
			className="comment-wrapper"
			id={`comment-${comment.id}`}
		>
			<div
				className={`comment-item ${comment.isPinned ? "pinned" : ""} ${isHighlighted ? "is-highlighted" : ""} ${isMentionHighlighted ? "is-mention-highlighted" : ""} ${isCompact ? "compact" : ""}`}
				onMouseLeave={() => {
					setIsActionSuppressed(false);
				}}
			>
				{replyToName && replyToCommentId && (
					<div className="reply-context-line">
						<div className="reply-curve-spacer" />
						<div className="reply-curve" />
						<button type="button" className="reply-snippet" onClick={handleReplyContextClick}>
							<span className="reply-target">@{replyToName}</span>
							{replyToPreview && <span className="reply-preview">{replyToPreview}</span>}
						</button>
					</div>
				)}

				<div className="comment-main-row">
					<div className={`comment-avatar ${isCompact ? "compact-spacer" : ""}`}>
						{!isCompact &&
							(avatarSrc ? (
								<SafeImage
									src={avatarSrc}
									alt=""
									width={36}
									height={36}
									className="avatar-img"
									onError={() => {
										setAvatarState((prev) => ({
											seed: avatarSeed,
											index: prev.seed === avatarSeed ? prev.index + 1 : 1,
										}));
									}}
								/>
							) : (
								<div className="avatar-fallback">{comment.author.nickname[0].toUpperCase()}</div>
							))}
					</div>

					<div className="comment-content">
						{!isCompact && (
							<div className="comment-header">
								<span className="comment-author">{comment.author.nickname}</span>
								{comment.isPostAuthor && <span className="comment-badge author">작성자</span>}
								{comment.isPinned && <span className="comment-badge pinned">📌 고정됨</span>}
							</div>
						)}

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
							<div className="comment-content-container">
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
									<div className="mt-2">
										<PollCard
											pollData={pollData}
											commentId={comment.id}
											onVote={(optionId) => onVote?.(comment.id, optionId)}
										/>
									</div>
								)}
							</div>
						)}
					</div>
				</div>

				{!isEditing && (
					<div className={`comment-actions ${isActionSuppressed ? "suppressed" : ""}`}>
						<button
							type="button"
							className="action-btn"
							onClick={() => onReplyRequest(resolvedThreadRootId, comment.author.nickname, replyPreviewForComposer)}
							title="답장"
						>
							<Reply size={18} />
						</button>

						{(isOwner || isAdmin) && (
							<button type="button" className="action-btn" onClick={() => setIsEditing(true)} title="수정">
								<Edit size={18} />
							</button>
						)}

						<button type="button" className="action-btn" onClick={handleCopyText} title="텍스트 복사">
							{copiedType === "text" ? <Check size={18} /> : <Copy size={18} />}
						</button>

						<button type="button" className="action-btn" onClick={handleCopyLink} title="링크 복사">
							{copiedType === "link" ? <Check size={18} /> : <Link2 size={18} />}
						</button>

						{isAdmin && onPin && (
							<button
								type="button"
								className="action-btn"
								onClick={() => onPin(comment.id)}
								title={comment.isPinned ? "고정 해제" : "고정"}
							>
								<Pin size={18} />
							</button>
						)}

						{isAdmin && (
							<button type="button" className="action-btn danger" onClick={(e) => onDelete(comment.id, e)} title="삭제">
								<Trash2 size={18} />
							</button>
						)}
					</div>
				)}
			</div>

			<style jsx>{`
				.comment-wrapper {
					margin-bottom: 4px;
					width: 100%;
				}

				.comment-item {
					display: flex;
					flex-direction: column;
					gap: 0;
					padding: 8px;
					border-radius: 6px;
					position: relative;
					transition: background-color 0.15s;
					align-items: stretch;
					width: 100%;
				}

				.comment-wrapper:hover .comment-item {
					background: rgba(0, 0, 0, 0.2);
				}

				.comment-item.compact {
					padding-top: 4px;
					padding-bottom: 4px;
				}

				.comment-main-row {
					display: flex;
					gap: 12px;
					width: 100%;
					align-items: flex-start;
				}

				.comment-item.is-highlighted {
					background: rgba(255, 215, 64, 0.2);
					box-shadow: inset 0 0 0 1px rgba(255, 222, 89, 0.8);
					animation: reply-highlight-pulse 1.2s ease;
				}

				.comment-item.is-mention-highlighted {
					background: rgba(255, 215, 64, 0.12);
					box-shadow: inset 0 0 0 1px rgba(255, 224, 130, 0.65);
				}

				.comment-item.pinned {
					background: rgba(139, 35, 50, 0.15);
					border-left: 3px solid var(--accent);
				}

				.comment-wrapper:hover .comment-item.pinned {
					background: rgba(139, 35, 50, 0.2);
				}

				.comment-avatar {
					flex-shrink: 0;
					margin-top: 1px;
				}

				.comment-avatar.compact-spacer {
					width: 36px;
					height: 4px;
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

				.reply-context-line {
					display: flex;
					align-items: flex-start;
					margin-bottom: 2px;
					position: relative;
				}

				.reply-curve-spacer {
					width: 18px; /* 36px 아바타의 절반 */
					flex-shrink: 0;
				}

				.reply-curve {
					width: 14px;
					height: 12px;
					border-left: 1.5px solid rgba(255, 255, 255, 0.4);
					border-top: 1.5px solid rgba(255, 255, 255, 0.4);
					border-top-left-radius: 6px;
					margin-right: 6px;
					margin-top: 8px;
				}

				.reply-snippet {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					font-size: 0.8rem;
					color: var(--text-muted);
					cursor: pointer;
					background: #2B2A28;
					padding: 4px 10px;
					border-radius: 6px;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					max-width: min(100%, 520px);
					border: 1px solid rgba(255, 255, 255, 0.05);
					transition: background 0.15s ease, color 0.15s ease;
					margin-bottom: 2px;
				}

				.reply-target {
					color: var(--text-secondary);
					font-weight: 600;
					flex-shrink: 0;
				}

				.reply-preview {
					overflow: hidden;
					text-overflow: ellipsis;
				}

				.reply-snippet:hover {
					background: #2B2A28;
					color: var(--text-primary);
				}

				.comment-content-container {
					position: relative;
					width: 100%;
					display: flex;
					flex-direction: column;
				}

				.comment-content-row {
					display: flex;
					flex-direction: row;
					align-items: flex-start;
					gap: 8px;
					position: relative;
					width: 100%;
					max-width: 100%;
				}

				.comment-body {
					color: var(--text-secondary);
					font-size: 0.9rem;
					line-height: 1.5;
					max-width: min(100%, 1320px);
					min-width: 0;
					flex: 1 1 auto;
				}

				.comment-body :global(.link-text) {
					color: var(--text-primary) !important;
					text-decoration: underline;
					text-decoration-thickness: 1px;
					text-underline-offset: 2px;
				}

				.comment-body :global(.post-content) {
					margin: 0;
				}

				.comment-body :global(.embed-container) {
					width: fit-content;
					max-width: 100%;
					min-height: 0;
					aspect-ratio: auto;
				}

				.comment-body :global(.embed-container video),
				.comment-body :global(.embed-container img) {
					display: block;
					width: auto;
					max-width: 100%;
					height: auto;
					max-height: min(56vh, 420px);
				}

				.comment-body :global(.embed-container iframe) {
					display: block;
					width: min(100%, 720px);
					height: auto;
					aspect-ratio: 16 / 9;
					min-height: 0;
				}

				.comment-body :global(.embed-container--streamable) {
					width: min(100%, 820px);
					max-width: 100%;
					min-height: min(52vw, 320px);
				}

				.comment-body :global(.embed-container__iframe--streamable) {
					width: min(100%, 820px);
					min-height: min(52vw, 320px);
				}

				.comment-hover-time {
					font-size: 0.7rem;
					color: rgba(255, 255, 255, 0.4);
					opacity: 0;
					transition: opacity 0.15s ease;
					user-select: none;
					white-space: nowrap;
					pointer-events: none;
					font-family: inherit;
					position: static;
					align-self: center;
					max-width: min(36%, 220px);
					overflow: hidden;
					text-overflow: ellipsis;
					text-align: right;
					flex: 0 0 auto;
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
					background: #2b2a28;
					border: 1px solid rgba(255, 255, 255, 0.08);
					border-radius: 6px;
					padding: 3px;
					box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
					opacity: 0;
					pointer-events: none;
					transition: opacity 0.15s ease;
				}

				.comment-wrapper:hover .comment-actions,
				.comment-wrapper:focus-within .comment-actions {
					opacity: 1;
					pointer-events: auto;
				}

				.comment-actions.suppressed {
					opacity: 0 !important;
					pointer-events: none !important;
				}

				.action-btn {
					padding: 5px 6px;
					background: none;
					border: none;
					color: var(--text-muted);
					cursor: pointer;
					border-radius: 4px;
					transition: background 0.2s ease, color 0.15s ease;
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.action-btn:hover {
					background: rgba(0, 0, 0, 0.4);
					color: var(--text-primary);
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

				@media (max-width: 768px) {
					.comment-content-row {
						gap: 6px;
					}

					.comment-hover-time {
						font-size: 0.65rem;
						max-width: min(42%, 180px);
					}
				}

				@keyframes reply-highlight-pulse {
					0% {
						box-shadow: inset 0 0 0 1px rgba(255, 222, 89, 0.55);
					}
					50% {
						box-shadow: inset 0 0 0 2px rgba(255, 222, 89, 0.9);
					}
					100% {
						box-shadow: inset 0 0 0 1px rgba(255, 222, 89, 0.55);
					}
				}
			`}</style>
		</div>
	);
}
