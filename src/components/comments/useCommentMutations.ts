"use client";

/**
 * 댓글 CRUD API 호출 + 트리 상태 갱신 커스텀 훅
 */

import { type Dispatch, type SetStateAction, useCallback, useState } from "react";
import { useToast } from "@/components/ui/useToast";
import {
	type Comment,
	appendReplyToThread,
	removeCommentFromTree,
	updateCommentInTree,
	updateCommentPinnedInTree,
} from "@/lib/comment-tree-ops";

// 댓글 생성 API 응답 타입
interface CreateCommentResponse {
	error?: string;
	comment: Comment;
}

// 댓글 수정 API 응답 타입
interface UpdateCommentResponse {
	error?: string;
	comment: { content: string; updatedAt: string };
}

interface VoteCommentResponse {
	error?: string;
	comment: { content: string; updatedAt: string };
}

// 댓글 고정 토글 API 응답 타입
interface PinToggleResponse {
	error?: string;
	comment?: { id: number; isPinned: boolean };
}

interface UseCommentMutationsOptions {
	postId: number;
	session: { user?: { id?: string | number } } | null;
	setComments: Dispatch<SetStateAction<Comment[]>>;
	setReplyTarget: Dispatch<SetStateAction<{ parentId: number; nickname: string } | null>>;
	setExpandedThreadRoots: Dispatch<SetStateAction<Set<number>>>;
	setPendingDeleteId: Dispatch<SetStateAction<number | null>>;
}

export function useCommentMutations({
	postId,
	session,
	setComments,
	setReplyTarget,
	setExpandedThreadRoots,
	setPendingDeleteId,
}: UseCommentMutationsOptions) {
	const { showToast } = useToast();
	const [isLoading, setIsLoading] = useState(false);

	// 댓글 생성
	const handleCommentCreate = useCallback(
		async (content: string, parentId: number | null = null) => {
			if (!session?.user) {
				showToast({ type: "error", message: "로그인이 필요함" });
				throw new Error("unauthenticated");
			}
			setIsLoading(true);
			try {
				const response = await fetch(`/api/posts/${postId}/comments`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ content, parentId }),
				});
				const data = (await response.json()) as CreateCommentResponse;
				if (!response.ok) {
					throw new Error(data.error || "Failed to create comment");
				}
				if (parentId === null) {
					setComments((prev) => [...prev, data.comment]);
				} else {
					setComments((prev) => appendReplyToThread(prev, parentId, data.comment));
					setReplyTarget(null);
					setExpandedThreadRoots((prev) => {
						const next = new Set(prev);
						next.add(parentId);
						return next;
					});
				}
			} catch (error) {
				showToast({ type: "error", message: "댓글 작성 실패" });
				throw error;
			} finally {
				setIsLoading(false);
			}
		},
		[postId, session, setComments, setReplyTarget, setExpandedThreadRoots, showToast]
	);

	// 댓글 수정
	const handleCommentUpdate = useCallback(
		async (commentId: number, content: string) => {
			setIsLoading(true);
			try {
				const response = await fetch(`/api/comments/${commentId}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ content }),
				});
				const data = (await response.json()) as UpdateCommentResponse;
				if (!response.ok) {
					throw new Error(data.error || "Failed to update comment");
				}
				setComments((prev) => updateCommentInTree(prev, commentId, data.comment.content, data.comment.updatedAt));
				showToast({ type: "success", message: "댓글 수정 완료" });
			} catch (error) {
				showToast({ type: "error", message: "댓글 수정 실패" });
				throw error;
			} finally {
				setIsLoading(false);
			}
		},
		[setComments, showToast]
	);

	// 댓글 삭제 확정
	const handleCommentDeleteConfirmed = useCallback(
		async (commentId?: number, pendingDeleteId?: number | null) => {
			const idToDelete = commentId ?? pendingDeleteId;
			if (idToDelete === null || idToDelete === undefined) {
				return;
			}
			setIsLoading(true);
			try {
				const response = await fetch(`/api/comments/${idToDelete}`, {
					method: "DELETE",
				});
				if (!response.ok) {
					const data = await response.json();
					throw new Error(data.error || "Failed to delete comment");
				}
				setComments((prev) => removeCommentFromTree(prev, idToDelete));
				setPendingDeleteId(null);
				showToast({ type: "success", message: "댓글 삭제 완료" });
			} catch {
				showToast({ type: "error", message: "댓글 삭제 실패" });
			} finally {
				setIsLoading(false);
			}
		},
		[setComments, setPendingDeleteId, showToast]
	);

	// 댓글 고정 토글
	const handleCommentPinToggle = useCallback(
		async (commentId: number) => {
			setIsLoading(true);
			try {
				const response = await fetch(`/api/comments/${commentId}/pin`, {
					method: "POST",
				});
				const data = (await response.json()) as PinToggleResponse;
				if (!response.ok || !data.comment) {
					throw new Error(data.error || "Failed to toggle comment pin");
				}
				setComments((prev) => updateCommentPinnedInTree(prev, commentId, data.comment!.isPinned));
				showToast({
					type: "success",
					message: data.comment.isPinned ? "댓글 고정 완료" : "댓글 고정 해제 완료",
				});
			} catch {
				showToast({ type: "error", message: "댓글 고정 처리 실패" });
			} finally {
				setIsLoading(false);
			}
		},
		[setComments, showToast]
	);

	const handleCommentVote = useCallback(
		async (commentId: number, optionId: number) => {
			if (!session?.user) {
				showToast({ type: "error", message: "로그인이 필요함" });
				throw new Error("unauthenticated");
			}
			const response = await fetch(`/api/comments/${commentId}/vote`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ optionId }),
			});
			const data = (await response.json()) as VoteCommentResponse;
			if (!response.ok) {
				showToast({ type: "error", message: "투표 처리 실패" });
				throw new Error(data.error || "Failed to vote poll");
			}
			setComments((prev) => updateCommentInTree(prev, commentId, data.comment.content, data.comment.updatedAt));
		},
		[session, setComments, showToast]
	);

	return {
		isLoading,
		handleCommentCreate,
		handleCommentUpdate,
		handleCommentDeleteConfirmed,
		handleCommentPinToggle,
		handleCommentVote,
	};
}
