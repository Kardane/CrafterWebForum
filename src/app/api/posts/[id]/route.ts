import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PrismaClient } from '@/generated/client';

const prisma = new PrismaClient();

/**
 * GET /api/posts/[id]
 * 게시글 상세 조회 (댓글 포함, 읽음 상태 업데이트)
 */
export async function GET(
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

		// 게시글 조회 (작성자 정보 포함)
		const post = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
			include: {
				author: {
					select: {
						id: true,
						nickname: true,
						minecraftUuid: true,
					},
				},
			},
		});

		if (!post) {
			return NextResponse.json({ error: 'Post not found' }, { status: 404 });
		}

		// 좋아요 여부 확인
		const userLiked = await prisma.like.findFirst({
			where: {
				postId: post.id,
				userId: session.user.id,
			},
		});

		// 댓글 조회 (고정된 댓글 우선)
		const comments = await prisma.comment.findMany({
			where: {
				postId: post.id,
			},
			include: {
				author: {
					select: {
						id: true,
						nickname: true,
						minecraftUuid: true,
					},
				},
			},
			orderBy: [{ isPinned: 'desc' }, { createdAt: 'asc' }],
		});

		// 읽음 상태 업데이트
		await prisma.postRead.upsert({
			where: {
				userId_postId: {
					userId: session.user.id,
					postId: post.id,
				},
			},
			update: {
				lastReadCommentCount: comments.length,
				updatedAt: new Date(),
			},
			create: {
				userId: session.user.id,
				postId: post.id,
				lastReadCommentCount: comments.length,
			},
		});

		// 응답 데이터 구성
		const responsePost = {
			id: post.id,
			title: post.title,
			content: post.content,
			tags: post.tags ? JSON.parse(post.tags as string) : [],
			likes: post.likes,
			views: post.views,
			createdAt: post.createdAt,
			updatedAt: post.updatedAt,
			author_id: post.authorId,
			author_name: post.author.nickname,
			author_uuid: post.author.minecraftUuid,
			user_liked: !!userLiked,
		};

		return NextResponse.json({
			post: responsePost,
			comments: comments.map((c) => ({
				id: c.id,
				content: c.content,
				createdAt: c.createdAt,
				author_id: c.authorId,
				author_name: c.author.nickname,
				author_uuid: c.author.minecraftUuid,
				is_pinned: c.isPinned,
			})),
		});
	} catch (error) {
		console.error('[API] GET /api/posts/[id] error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * PATCH /api/posts/[id]
 * 게시글 수정 (작성자만 가능)
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

		const postId = parseInt(id);
		if (isNaN(postId)) {
			return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
		}

		const body = await request.json();
		const { title, content, tags } = body;

		if (!title || !content) {
			return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
		}

		// 게시글 존재 및 권한 확인
		const post = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
		});

		if (!post) {
			return NextResponse.json({ error: 'Post not found' }, { status: 404 });
		}

		if (post.authorId !== session.user.id) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// 게시글 수정
		await prisma.post.update({
			where: { id: postId },
			data: {
				title,
				content,
				tags: JSON.stringify(tags || []),
				updatedAt: new Date(),
			},
		});

		return NextResponse.json({ success: true, message: 'Post updated successfully' });
	} catch (error) {
		console.error('[API] PATCH /api/posts/[id] error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * DELETE /api/posts/[id]
 * 게시글 삭제 (Soft Delete, 작성자만 가능)
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

		const postId = parseInt(id);
		if (isNaN(postId)) {
			return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
		}

		// 게시글 존재 및 권한 확인
		const post = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
		});

		if (!post) {
			return NextResponse.json({ error: 'Post not found' }, { status: 404 });
		}

		if (post.authorId !== session.user.id && session.user.role !== 'admin') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// Soft Delete
		await prisma.post.update({
			where: { id: postId },
			data: {
				deletedAt: new Date(),
			},
		});

		return NextResponse.json({ success: true, message: 'Post deleted successfully' });
	} catch (error) {
		console.error('[API] DELETE /api/posts/[id] error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
