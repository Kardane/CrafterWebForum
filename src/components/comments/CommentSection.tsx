'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import CommentItem from './CommentItem';
import CommentForm from './CommentForm';

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

interface CommentSectionProps {
	postId: number;
	initialComments: Comment[];
}

export default function CommentSection({ postId, initialComments }: CommentSectionProps) {
	const { data: session } = useSession();
	const [comments, setComments] = useState<Comment[]>(initialComments);
	const [isLoading, setIsLoading] = useState(false);

	const handleCommentCreate = async (content: string, parentId: number | null = null) => {
		if (!session?.user) {
			alert('로그인이 필요합니다.');
			return;
		}

		setIsLoading(true);

		try {
			const res = await fetch(`/api/posts/${postId}/comments`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ content, parentId }),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to create comment');
			}

			// 낙관적 업데이트
			if (parentId === null) {
				// 최상위 댓글
				setComments((prev) => [...prev, data.comment]);
			} else {
				// 대댓글 - 부모 댓글의 replies에 추가
				setComments((prev) =>
					prev.map((comment) => {
						if (comment.id === parentId) {
							return {
								...comment,
								replies: [...comment.replies, data.comment],
							};
						}
						return comment;
					})
				);
			}
		} catch (error) {
			console.error('Comment create error:', error);
			alert('댓글 작성에 실패했습니다.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleCommentUpdate = async (commentId: number, content: string) => {
		setIsLoading(true);

		try {
			const res = await fetch(`/api/comments/${commentId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ content }),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to update comment');
			}

			// 댓글 업데이트
			setComments((prev) =>
				prev.map((comment) => {
					if (comment.id === commentId) {
						return { ...comment, content: data.comment.content, updatedAt: data.comment.updatedAt };
					}
					// 대댓글 업데이트
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
		} catch (error) {
			console.error('Comment update error:', error);
			alert('댓글 수정에 실패했습니다.');
		} finally {
			setIsLoading(false);
		}
	};

	const handleCommentDelete = async (commentId: number) => {
		if (!confirm('댓글을 삭제하시겠습니까?')) {
			return;
		}

		setIsLoading(true);

		try {
			const res = await fetch(`/api/comments/${commentId}`, {
				method: 'DELETE',
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to delete comment');
			}

			// 댓글 삭제 (대댓글도 함께 삭제)
			setComments((prev) =>
				prev
					.filter((comment) => comment.id !== commentId)
					.map((comment) => ({
						...comment,
						replies: comment.replies.filter((reply) => reply.id !== commentId),
					}))
			);
		} catch (error) {
			console.error('Comment delete error:', error);
			alert('댓글 삭제에 실패했습니다.');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="space-y-6">
			<h2 className="text-xl font-bold">댓글 {comments.length}개</h2>

			{/* 댓글 작성 폼 */}
			<CommentForm onSubmit={(content) => handleCommentCreate(content, null)} disabled={isLoading} />

			{/* 댓글 목록 */}
			<div className="space-y-4">
				{comments.length === 0 ? (
					<div className="text-center text-text-muted py-8">첫 댓글을 작성해보세요!</div>
				) : (
					comments.map((comment) => (
						<CommentItem
							key={comment.id}
							comment={comment}
							onReply={(content) => handleCommentCreate(content, comment.id)}
							onEdit={handleCommentUpdate}
							onDelete={handleCommentDelete}
							disabled={isLoading}
						/>
					))
				)}
			</div>
		</div>
	);
}
