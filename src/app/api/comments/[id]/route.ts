import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PrismaClient } from '@/generated/client';

const prisma = new PrismaClient();

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

		const commentId = parseInt(id);
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

		if (comment.authorId !== session.user.id) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// 댓글 수정
		const updated = await prisma.comment.update({
			where: { id: commentId },
			data: {
				content,
				updatedAt: new Date(),
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
		});

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
				author: updated.author,
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

		const commentId = parseInt(id);
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

		if (comment.authorId !== session.user.id && session.user.role !== 'admin') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// 댓글 삭제 (대댓글도 함께 삭제)
		await prisma.comment.deleteMany({
			where: {
				OR: [{ id: commentId }, { parentId: commentId }],
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
