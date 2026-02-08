import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PrismaClient } from '@/generated/client';

const prisma = new PrismaClient();

/**
 * GET /api/users/me
 * 내 정보 및 통계 조회
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// 사용자 정보 조회
		const user = await prisma.user.findUnique({
			where: { id: session.user.id },
			select: {
				id: true,
				email: true,
				nickname: true,
				minecraftUuid: true,
				role: true,
				createdAt: true,
				lastAuthAt: true,
			},
		});

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		// 통계 조회 (게시글 수, 댓글 수)
		const [postCount, commentCount] = await Promise.all([
			prisma.post.count({ where: { authorId: user.id, deletedAt: null } }),
			prisma.comment.count({ where: { authorId: user.id } }),
		]);

		return NextResponse.json({
			user,
			stats: {
				posts: postCount,
				comments: commentCount,
			},
		});
	} catch (error) {
		console.error('[API] GET /api/users/me error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
