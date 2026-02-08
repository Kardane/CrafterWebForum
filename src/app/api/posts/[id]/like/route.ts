import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PrismaClient } from '@/generated/client';

const prisma = new PrismaClient();

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
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const postId = parseInt(id);
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

		// 좋아요 여부 확인
		const existing = await prisma.like.findFirst({
			where: {
				postId,
				userId: session.user.id,
			},
		});

		if (existing) {
			// 좋아요 취소
			await prisma.like.delete({
				where: { id: existing.id },
			});

			await prisma.post.update({
				where: { id: postId },
				data: { likes: { decrement: 1 } },
			});

			const updatedPost = await prisma.post.findUnique({
				where: { id: postId },
				select: { likes: true },
			});

			return NextResponse.json({
				success: true,
				message: 'Like removed',
				liked: false,
				likes: updatedPost?.likes || 0,
			});
		} else {
			// 좋아요 추가
			await prisma.like.create({
				data: {
					postId,
					userId: session.user.id,
				},
			});

			await prisma.post.update({
				where: { id: postId },
				data: { likes: { increment: 1 } },
			});

			const updatedPost = await prisma.post.findUnique({
				where: { id: postId },
				select: { likes: true },
			});

			return NextResponse.json({
				success: true,
				message: 'Like added',
				liked: true,
				likes: updatedPost?.likes || 0,
			});
		}
	} catch (error) {
		console.error('[API] POST /api/posts/[id]/like error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
