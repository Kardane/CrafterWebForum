import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { toSessionUserId } from '@/lib/session-user';
import { getPostMutationTags, parsePostTags, safeRevalidateTags } from '@/lib/cache-tags';
import { broadcastRealtime } from '@/lib/realtime/server-broadcast';
import { REALTIME_EVENTS, REALTIME_TOPICS } from '@/lib/realtime/constants';
import { isMissingPostCommentCountColumnError } from '@/lib/db-schema-guard';


/**
 * PATCH /api/comments/[id]
 * 댓글 수정 (작성자만 가능)
 */
export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		const sessionUserId = toSessionUserId(session.user.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const commentId = parseInt(id, 10);
		if (isNaN(commentId)) {
			return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400 });
		}

		const body = await request.json();
		const { content } = body;

		if (!content || !content.trim()) {
			return NextResponse.json({ error: 'Content is required' }, { status: 400 });
		}

		// 댓글 존재 및 권한 확인
		const comment = await prisma.comment.findUnique({
			where: { id: commentId },
		});

		if (!comment) {
			return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
		}

		if (comment.authorId !== sessionUserId && session.user.role !== 'admin') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// 댓글 수정
		const updated = await prisma.comment.update({
			where: { id: commentId },
			data: {
				content,
				updatedAt: new Date(),
			},
			select: {
				id: true,
				content: true,
				createdAt: true,
				updatedAt: true,
				isPinned: true,
				parentId: true,
			},
		});

		try {
			await prisma.post.update({
				where: { id: comment.postId },
				data: { updatedAt: new Date() },
			});
		} catch (error) {
			console.warn('[API] PATCH /api/comments/[id] post timestamp update failed; continuing', error);
		}

		try {
			safeRevalidateTags(
				getPostMutationTags({
					postId: comment.postId,
				})
			);
		} catch (error) {
			console.warn('[API] PATCH /api/comments/[id] cache revalidate failed; continuing', error);
		}

		try {
			void broadcastRealtime({
				topic: REALTIME_TOPICS.post(comment.postId),
				event: REALTIME_EVENTS.COMMENT_UPDATED,
				payload: {
					postId: comment.postId,
					commentId: updated.id,
					actorUserId: sessionUserId,
					content: updated.content,
					updatedAt: updated.updatedAt,
				},
			});
		} catch (error) {
			console.warn('[API] PATCH /api/comments/[id] realtime broadcast failed; continuing', error);
		}

		return NextResponse.json({
			success: true,
			message: 'Comment updated successfully',
			comment: {
				id: updated.id,
				content: updated.content,
				createdAt: updated.createdAt,
				updatedAt: updated.updatedAt,
				isPinned: updated.isPinned,
				parentId: updated.parentId,
			},
		});
	} catch (error) {
		console.error('[API] PATCH /api/comments/[id] error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * DELETE /api/comments/[id]
 * 댓글 삭제 (작성자 또는 관리자만 가능)
 */
export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		const sessionUserId = toSessionUserId(session.user.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const commentId = parseInt(id, 10);
		if (isNaN(commentId)) {
			return NextResponse.json({ error: 'Invalid comment ID' }, { status: 400 });
		}

		// 댓글 존재 및 권한 확인
		const comment = await prisma.comment.findUnique({
			where: { id: commentId },
		});

		if (!comment) {
			return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
		}

		if (comment.authorId !== sessionUserId && session.user.role !== 'admin') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}
		const postForTags = await prisma.post.findUnique?.({
			where: { id: comment.postId },
			select: { tags: true },
		});

		// 댓글 삭제 (대댓글도 함께 삭제)
		const deletedResult = await prisma.comment.deleteMany({
			where: {
				OR: [{ id: commentId }, { parentId: commentId }],
			},
		});
		const deletedCommentCount = deletedResult.count;
		try {
			const postSummary = await prisma.post.findUnique?.({
				where: { id: comment.postId },
				select: { commentCount: true },
			});
			const nextCommentCount = Math.max((postSummary?.commentCount ?? 0) - deletedCommentCount, 0);

			await prisma.post.update({
				where: { id: comment.postId },
				data: {
					updatedAt: new Date(),
					commentCount: nextCommentCount,
				},
				select: { id: true },
			});
		} catch (error) {
			if (!isMissingPostCommentCountColumnError(error)) {
				throw error;
			}
			await prisma.post.update({
				where: { id: comment.postId },
				data: {
					updatedAt: new Date(),
				},
				select: { id: true },
			});
		}
		safeRevalidateTags(
			getPostMutationTags({
				postId: comment.postId,
				tags: parsePostTags(postForTags?.tags ?? null),
			})
		);

		void broadcastRealtime({
			topic: REALTIME_TOPICS.post(comment.postId),
			event: REALTIME_EVENTS.COMMENT_DELETED,
			payload: {
				postId: comment.postId,
				commentId,
				actorUserId: sessionUserId,
			},
		});

		return NextResponse.json({
			success: true,
			message: 'Comment deleted successfully',
		});
	} catch (error) {
		console.error('[API] DELETE /api/comments/[id] error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
