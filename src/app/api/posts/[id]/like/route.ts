import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getPostMutationTags, parsePostTags, safeRevalidateTags } from '@/lib/cache-tags';
import { broadcastRealtime } from '@/lib/realtime/server-broadcast';
import { REALTIME_EVENTS, REALTIME_TOPICS } from '@/lib/realtime/constants';
import { resolveActiveUserFromSession } from '@/lib/active-user';


/**
 * POST /api/posts/[id]/like
 * 좋아요 토글 (중복 방지, 낙관적 업데이트 지원)
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session);
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}
		const sessionUserId = activeUser.context.userId;

		const postId = parseInt(id, 10);
		if (isNaN(postId)) {
			return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
		}

		// 게시글 존재 확인
		const post = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
		});

		if (!post) {
			return NextResponse.json({ error: 'Post not found' }, { status: 404 });
		}
		const postTags = parsePostTags(post.tags);

		const toggled = await prisma.$transaction(async (tx) => {
			const existing = await tx.like.findUnique({
				where: {
					postId_userId: {
						postId,
						userId: sessionUserId,
					},
				},
				select: { id: true },
			});

			if (existing) {
				await tx.like.delete({ where: { id: existing.id } });
				const updated = await tx.post.update({
					where: { id: postId },
					data: { likes: { decrement: 1 } },
					select: { likes: true },
				});
				return {
					liked: false,
					likes: updated.likes,
					message: 'Like removed',
				};
			}

			await tx.like.create({
				data: {
					postId,
					userId: sessionUserId,
				},
			});
			const updated = await tx.post.update({
				where: { id: postId },
				data: { likes: { increment: 1 } },
				select: { likes: true },
			});
			return {
				liked: true,
				likes: updated.likes,
				message: 'Like added',
			};
		});

		void broadcastRealtime({
			topic: REALTIME_TOPICS.post(postId),
			event: REALTIME_EVENTS.POST_LIKE_TOGGLED,
			payload: {
				postId,
				likes: toggled.likes,
				actorUserId: sessionUserId,
				likedByActor: toggled.liked,
			},
		});
		safeRevalidateTags(
			getPostMutationTags({
				postId,
				tags: postTags,
			})
		);

		return NextResponse.json({
			success: true,
			message: toggled.message,
			liked: toggled.liked,
			likes: toggled.likes,
		});

	} catch (error) {
		console.error('[API] POST /api/posts/[id]/like error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
