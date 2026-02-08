"use client";

import { useEffect, useRef, useState } from "react";
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

function getLatestCommentId(comments: Comment[]): number | null {
	const getLatest = (nodes: Comment[]): { id: number; createdAt: number } | null => {
		return nodes.reduce<{ id: number; createdAt: number } | null>((latestNode, node) => {
			const createdAtTime = new Date(node.createdAt).getTime();
			const currentNode = { id: node.id, createdAt: createdAtTime };
			const latestReply = node.replies.length > 0 ? getLatest(node.replies) : null;
			const latestCandidate = latestReply && latestReply.createdAt > currentNode.createdAt ? latestReply : currentNode;

			if (!latestNode || latestCandidate.createdAt >= latestNode.createdAt) {
				return latestCandidate;
			}

			return latestNode;
		}, null);
	};

	return getLatest(comments)?.id ?? null;
}

export default function CommentSection({ postId, initialComments }: CommentSectionProps) {
	const { data: session } = useSession();
	const { showToast } = useToast();
	const [comments, setComments] = useState<Comment[]>(initialComments);
	const [isLoading, setIsLoading] = useState(false);
	const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
	const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
	const hasAutoJumpedRef = useRef(false);

	useEffect(() => {
		if (hasAutoJumpedRef.current) {
			return;
		}
		hasAutoJumpedRef.current = true;

		if (window.location.hash.startsWith("#comment-")) {
			return;
		}

		const latestCommentId = getLatestCommentId(initialComments);
		if (!latestCommentId) {
			return;
		}

		requestAnimationFrame(() => {
			const element = document.getElementById(`comment-${latestCommentId}`);
			element?.scrollIntoView({ behavior: "auto", block: "center" });
		});
	}, [initialComments]);

	const handleCommentCreate = async (content: string, parentId: number | null = null) => {
		if (!session?.user) {
			showToast({ type: "error", message: "로그인이 필요함" });
			throw new Error("unauthenticated");
		}

		setIsLoading(true);

		try {
			const res = await fetch(`/api/posts/${postId}/comments`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ content, parentId }),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || "Failed to create comment");
			}

			if (parentId === null) {
				setComments((prev) => [...prev, data.comment]);
			} else {
				setComments((prev) =>
					prev.map((comment) => {
						if (comment.id !== parentId) {
							return comment;
						}
						return {
							...comment,
							replies: [...comment.replies, data.comment],
						};
					})
				);
			}

			if (parentId !== null) {
				setReplyTarget(null);
			}
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
			const res = await fetch(`/api/comments/${commentId}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ content }),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || "Failed to update comment");
			}

			setComments((prev) =>
				prev.map((comment) => {
					if (comment.id === commentId) {
						return {
							...comment,
							content: data.comment.content,
							updatedAt: data.comment.updatedAt,
						};
					}
					return {
						...comment,
						replies: comment.replies.map((reply) =>
							reply.id === commentId
								? { ...reply, content: data.comment.content, updatedAt: data.comment.updatedAt }
								: reply
						),
					};
				})
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
			const res = await fetch(`/api/comments/${pendingDeleteId}`, {
				method: "DELETE",
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || "Failed to delete comment");
			}

			setComments((prev) =>
				prev
					.filter((comment) => comment.id !== pendingDeleteId)
					.map((comment) => ({
						...comment,
						replies: comment.replies.filter((reply) => reply.id !== pendingDeleteId),
					}))
			);
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
			document.getElementById("comment-composer")?.scrollIntoView({ behavior: "smooth", block: "end" });
		});
	};

	return (
		<div className="comment-section">
			<h2 className="text-xl font-bold">댓글 {comments.length}개</h2>

			<div className="comment-list space-y-4">
				{comments.length === 0 ? (
					<div className="text-center text-text-muted py-8">첫 댓글 써줘</div>
				) : (
					comments.map((comment) => (
						<CommentItem
							key={comment.id}
							comment={comment}
							onReplyRequest={handleReplyRequest}
							onEdit={handleCommentUpdate}
							onDelete={(commentId) => setPendingDeleteId(commentId)}
							disabled={isLoading}
						/>
					))
				)}
			</div>

			<div className="composer-footer" id="comment-composer">
				<CommentForm
					onSubmit={(content) => handleCommentCreate(content, replyTarget?.parentId ?? null)}
					disabled={isLoading}
					variant="composer"
					replyTo={replyTarget?.nickname}
					onCancel={replyTarget ? () => setReplyTarget(null) : undefined}
					placeholder={replyTarget ? "답장 작성 중..." : "댓글을 입력해줘"}
				/>
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
					gap: 16px;
				}

				.comment-list {
					padding-bottom: 170px;
				}

				.composer-footer {
					position: sticky;
					bottom: 0;
					z-index: 24;
					margin-top: 8px;
					padding-top: 10px;
					background: var(--bg-primary);
					border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
				}

				@media (max-width: 768px) {
					.comment-list {
						padding-bottom: 188px;
					}
				}
			`}</style>
		</div>
	);
}
