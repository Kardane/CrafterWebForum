import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PrismaClient } from "@/generated/client";

const prisma = new PrismaClient();

interface CommentTreeNode {
	id: number;
	content: string;
	createdAt: Date;
	updatedAt: Date;
	isPinned: number;
	parentId: number | null;
	author: {
		id: number;
		nickname: string;
		minecraftUuid: string | null;
		role: string;
	};
	replies: CommentTreeNode[];
}

/**
 * GET /api/posts/[id]/comments
 * 댓글 목록 조회 (대댓글 포함)
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
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const postId = parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}

		const post = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
		});

		if (!post) {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}

		const comments = await prisma.comment.findMany({
			where: {
				postId,
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
			orderBy: [{ isPinned: "desc" }, { createdAt: "asc" }],
		});

		const commentMap = new Map<number, CommentTreeNode>();
		const rootComments: CommentTreeNode[] = [];

		comments.forEach((comment) => {
			const commentData: CommentTreeNode = {
				id: comment.id,
				content: comment.content,
				createdAt: comment.createdAt,
				updatedAt: comment.updatedAt,
				isPinned: comment.isPinned,
				parentId: comment.parentId,
				author: {
					id: comment.author.id,
					nickname: comment.author.nickname,
					minecraftUuid: comment.author.minecraftUuid,
					role: comment.author.role,
				},
				replies: [],
			};

			commentMap.set(comment.id, commentData);

			if (comment.parentId === null) {
				rootComments.push(commentData);
			}
		});

		comments.forEach((comment) => {
			if (comment.parentId !== null) {
				const parent = commentMap.get(comment.parentId);
				const child = commentMap.get(comment.id);
				if (parent && child) {
					parent.replies.push(child);
				}
			}
		});

		return NextResponse.json({ comments: rootComments });
	} catch (error) {
		console.error("[API] GET /api/posts/[id]/comments error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/posts/[id]/comments
 * 댓글 작성
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const postId = parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}

		const body = await request.json();
		const { content, parentId } = body;

		if (!content || !content.trim()) {
			return NextResponse.json({ error: "Content is required" }, { status: 400 });
		}

		const post = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
		});

		if (!post) {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}

		if (parentId) {
			const parentComment = await prisma.comment.findFirst({
				where: {
					id: parentId,
					postId,
				},
			});

			if (!parentComment) {
				return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
			}
		}

		const comment = await prisma.comment.create({
			data: {
				content,
				postId,
				authorId: session.user.id,
				parentId: parentId || null,
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

		const commentCount = await prisma.comment.count({
			where: { postId },
		});

		await prisma.postRead.upsert({
			where: {
				userId_postId: {
					userId: session.user.id,
					postId,
				},
			},
			update: {
				lastReadCommentCount: commentCount,
				updatedAt: new Date(),
			},
			create: {
				userId: session.user.id,
				postId,
				lastReadCommentCount: commentCount,
			},
		});

		return NextResponse.json({
			success: true,
			message: "Comment created successfully",
			comment: {
				id: comment.id,
				content: comment.content,
				createdAt: comment.createdAt,
				updatedAt: comment.updatedAt,
				isPinned: comment.isPinned,
				parentId: comment.parentId,
				author: comment.author,
				replies: [],
			},
		});
	} catch (error) {
		console.error("[API] POST /api/posts/[id]/comments error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
