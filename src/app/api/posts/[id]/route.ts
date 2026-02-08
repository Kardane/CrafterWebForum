import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { buildCommentTree } from '@/lib/comments';
import { toSessionUserId } from '@/lib/session-user';

/**
 * GET /api/posts/[id]
 * 게시글 상세 조회 (댓글 포함, 읽음 상태 업데이트)
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	void request;
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

		const postId = parseInt(id, 10);
		if (Number.isNaN(postId)) {
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

		const userLiked = await prisma.like.findFirst({
			where: {
				postId: post.id,
				userId: sessionUserId,
			},
		});

		// 댓글 조회 (고정 댓글 우선)
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
						role: true,
					},
				},
			},
			orderBy: [{ isPinned: 'desc' }, { createdAt: 'asc' }],
		});

		const commentsWithPostAuthorFlag = comments.map((comment) => ({
			...comment,
			isPostAuthor: comment.author.id === post.authorId,
		}));

		// 읽음 상태 업데이트
		await prisma.postRead.upsert({
			where: {
				userId_postId: {
					userId: sessionUserId,
					postId: post.id,
				},
			},
			update: {
				lastReadCommentCount: comments.length,
				updatedAt: new Date(),
			},
			create: {
				userId: sessionUserId,
				postId: post.id,
				lastReadCommentCount: comments.length,
			},
		});

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
			comments: buildCommentTree(commentsWithPostAuthorFlag),
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

		const sessionUserId = toSessionUserId(session.user.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const postId = parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
		}

		const body = await request.json();
		const { title, content, tags } = body;

		if (!title || !content) {
			return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
		}

		const post = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
		});

		if (!post) {
			return NextResponse.json({ error: 'Post not found' }, { status: 404 });
		}

		if (post.authorId !== sessionUserId) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

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
	void request;
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

		const postId = parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return NextResponse.json({ error: 'Invalid post ID' }, { status: 400 });
		}

		const post = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
		});

		if (!post) {
			return NextResponse.json({ error: 'Post not found' }, { status: 404 });
		}

		if (post.authorId !== sessionUserId && session.user.role !== 'admin') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

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
