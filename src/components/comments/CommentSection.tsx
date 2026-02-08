"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import CommentItem from "./CommentItem";
import CommentForm from "./CommentForm";
import { Modal } from "@/components/ui/Modal";
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

interface CommentSectionProps {
	postId: number;
	initialComments: Comment[];
}

interface ReplyTarget {
	parentId: number;
	nickname: string;
}

interface FlattenedComment {
	comment: Comment;
	threadRootId: number;
	replyToName: string | null;
	replyToCommentId: number | null;
}

function appendReplyToThread(nodes: Comment[], rootId: number, newComment: Comment): Comment[] {
	return nodes.map((node) => {
		if (node.id === rootId) {
			return {
				...node,
				replies: [...node.replies, newComment],
			};
		}

		if (node.replies.length === 0) {
			return node;
		}

		return {
			...node,
			replies: appendReplyToThread(node.replies, rootId, newComment),
		};
	});
}

function updateCommentInTree(nodes: Comment[], targetId: number, content: string, updatedAt: string): Comment[] {
	return nodes.map((node) => {
		if (node.id === targetId) {
			return {
				...node,
				content,
				updatedAt,
			};
		}

		if (node.replies.length === 0) {
			return node;
		}

		return {
			...node,
			replies: updateCommentInTree(node.replies, targetId, content, updatedAt),
		};
	});
}

function removeCommentFromTree(nodes: Comment[], targetId: number): Comment[] {
	return nodes
		.filter((node) => node.id !== targetId)
		.map((node) => ({
			...node,
			replies: removeCommentFromTree(node.replies, targetId),
		}));
}

function flattenComments(comments: Comment[]): FlattenedComment[] {
	const flattened: FlattenedComment[] = [];

	const walk = (
		nodes: Comment[],
		rootId: number | null,
		replyToName: string | null,
		replyToCommentId: number | null
	) => {
		nodes.forEach((node) => {
			const nextRootId = rootId ?? node.id;
			flattened.push({
				comment: node,
				threadRootId: nextRootId,
				replyToName,
				replyToCommentId,
			});
			if (node.replies.length > 0) {
				walk(node.replies, nextRootId, node.author.nickname, node.id);
			}
		});
	};

	walk(comments, null, null, null);

	return flattened.sort((a, b) => {
		if (a.comment.isPinned !== b.comment.isPinned) {
			return Number(b.comment.isPinned) - Number(a.comment.isPinned);
		}
		return new Date(a.comment.createdAt).getTime() - new Date(b.comment.createdAt).getTime();
	});
}

export default function CommentSection({ postId, initialComments }: CommentSectionProps) {
	const { data: session } = useSession();
	const { showToast } = useToast();
	const [comments, setComments] = useState<Comment[]>(initialComments);
	const [isLoading, setIsLoading] = useState(false);
	const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
	const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
	const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);
	const streamRef = useRef<HTMLDivElement>(null);
	const highlightTimerRef = useRef<number | null>(null);

	useEffect(
		() => () => {
			if (highlightTimerRef.current !== null) {
				window.clearTimeout(highlightTimerRef.current);
			}
		},
		[]
	);

	const flattenedComments = useMemo(() => flattenComments(comments), [comments]);

	const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
		requestAnimationFrame(() => {
			document.getElementById("comment-feed-end")?.scrollIntoView({ behavior, block: "end" });
		});
	};

	const handleCommentCreate = async (content: string, parentId: number | null = null) => {
		if (!session?.user) {
			showToast({ type: "error", message: "로그인이 필요함" });
			throw new Error("unauthenticated");
		}

		setIsLoading(true);
		try {
			const response = await fetch(`/api/posts/${postId}/comments`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ content, parentId }),
			});

			const data = (await response.json()) as { error?: string; comment: Comment };
			if (!response.ok) {
				throw new Error(data.error || "Failed to create comment");
			}

			if (parentId === null) {
				setComments((prev) => [...prev, data.comment]);
			} else {
				setComments((prev) => appendReplyToThread(prev, parentId, data.comment));
				setReplyTarget(null);
			}

			scrollToBottom("smooth");
		} catch (error) {
			console.error("Comment create error:", error);
			showToast({ type: "error", message: "댓글 작성 실패" });
			throw error;
		} finally {
			setIsLoading(false);
		}
	};

	const handleCommentUpdate = async (commentId: number, content: string) => {
		setIsLoading(true);
		try {
			const response = await fetch(`/api/comments/${commentId}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ content }),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || "Failed to update comment");
			}

			setComments((prev) =>
				updateCommentInTree(prev, commentId, data.comment.content, data.comment.updatedAt)
			);
			showToast({ type: "success", message: "댓글 수정 완료" });
		} catch (error) {
			console.error("Comment update error:", error);
			showToast({ type: "error", message: "댓글 수정 실패" });
			throw error;
		} finally {
			setIsLoading(false);
		}
	};

	const handleCommentDeleteConfirmed = async () => {
		if (pendingDeleteId === null) {
			return;
		}

		setIsLoading(true);
		try {
			const response = await fetch(`/api/comments/${pendingDeleteId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to delete comment");
			}

			setComments((prev) => removeCommentFromTree(prev, pendingDeleteId));
			setPendingDeleteId(null);
			showToast({ type: "success", message: "댓글 삭제 완료" });
		} catch (error) {
			console.error("Comment delete error:", error);
			showToast({ type: "error", message: "댓글 삭제 실패" });
		} finally {
			setIsLoading(false);
		}
	};

	const handleReplyRequest = (commentId: number, nickname: string) => {
		setReplyTarget({ parentId: commentId, nickname });
		requestAnimationFrame(() => {
			const input = document.getElementById("comment-composer-input");
			if (input instanceof HTMLTextAreaElement) {
				input.focus();
			}
		});
	};

	const handleNavigateToComment = (commentId: number) => {
		const target = document.getElementById(`comment-${commentId}`);
		if (!target) {
			showToast({ type: "error", message: "원본 댓글을 찾을 수 없음" });
			return;
		}

		target.scrollIntoView({ behavior: "smooth", block: "center" });
		setHighlightedCommentId(commentId);

		if (highlightTimerRef.current !== null) {
			window.clearTimeout(highlightTimerRef.current);
		}
		highlightTimerRef.current = window.setTimeout(() => {
			setHighlightedCommentId((prev) => (prev === commentId ? null : prev));
		}, 1600);
	};

	return (
		<div className="comment-section">
			<h2 className="text-xl font-bold">댓글 {flattenedComments.length}개</h2>

			<div className="comment-stream" ref={streamRef}>
				<div className="comment-list">
					{flattenedComments.length === 0 ? (
						<div className="py-8 text-center text-text-muted">첫 댓글 써줘</div>
					) : (
						flattenedComments.map((item) => (
							<CommentItem
								key={item.comment.id}
								comment={item.comment}
								replyToName={item.replyToName}
								replyToCommentId={item.replyToCommentId}
								threadRootId={item.threadRootId}
								isHighlighted={highlightedCommentId === item.comment.id}
								onNavigateToComment={handleNavigateToComment}
								onReplyRequest={handleReplyRequest}
								onEdit={handleCommentUpdate}
								onDelete={(commentId) => setPendingDeleteId(commentId)}
								disabled={isLoading}
							/>
						))
					)}
					<div id="comment-feed-end" />
				</div>
			</div>

			<div className="composer-dock">
				<div className="composer-shell" id="comment-composer">
					<CommentForm
						onSubmit={(content) => handleCommentCreate(content, replyTarget?.parentId ?? null)}
						disabled={isLoading}
						variant="composer"
						replyTo={replyTarget?.nickname}
						onCancel={replyTarget ? () => setReplyTarget(null) : undefined}
						placeholder={replyTarget ? "답장 작성 중..." : "댓글을 입력해줘"}
						textareaId="comment-composer-input"
					/>
				</div>
			</div>

			<Modal
				isOpen={pendingDeleteId !== null}
				onClose={() => setPendingDeleteId(null)}
				title="댓글 삭제"
				size="sm"
				variant="sidebarLike"
				footer={
					<div className="flex justify-end gap-2">
						<button type="button" className="btn btn-secondary btn-sm" onClick={() => setPendingDeleteId(null)}>
							취소
						</button>
						<button type="button" className="btn btn-danger btn-sm" onClick={handleCommentDeleteConfirmed}>
							삭제
						</button>
					</div>
				}
			>
				<p className="text-sm text-text-secondary">선택한 댓글을 삭제할까</p>
			</Modal>

			<style jsx>{`
				.comment-section {
					position: relative;
					display: flex;
					flex-direction: column;
				}

				.comment-stream {
					/* 통합 스크롤을 위해 개별 스크롤 및 배경 제거 */
				}

				.comment-list {
					padding: 0;
					padding-bottom: 20px;
				}

				.composer-dock {
					position: fixed;
					left: 0;
					right: 0;
					bottom: 0;
					z-index: 56;
					display: flex;
					justify-content: center;
					padding: 0 16px 0 16px; /* 하단 여백 제거 */
					pointer-events: none;
				}

				.composer-shell {
					width: 100%;
					max-width: 56rem;
					pointer-events: auto;
					border-radius: 8px 8px 0 0; /* 상단만 라운드 적용 */
					border: none;
					background: color-mix(in srgb, var(--color-bg-secondary) 95%, transparent);
					backdrop-filter: blur(4px);
					box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
					padding: 4px;
				}

				@media (min-width: 769px) {
					.composer-dock {
						left: var(--spacing-sidebar);
						padding-left: 32px;
						padding-right: 32px;
					}
				}

				@media (max-width: 768px) {
					.comment-stream {
						max-height: min(52vh, 620px);
					}
					
					.composer-dock {
						padding: 0 12px 16px 12px;
					}
					
					.composer-shell {
						/* 모바일 스타일 */
					}
				}
			`}</style>
		</div>
	);
}
