import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildCommentTree } from "@/lib/comments";
import { isSessionUserApproved, toSessionUserId } from "@/lib/session-user";
import { getPostMutationTags, parsePostTags, safeRevalidateTags } from "@/lib/cache-tags";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";
import { extractMentionNicknames } from "@/lib/mentions";

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
		if (!isSessionUserApproved(session.user.isApproved)) {
			return NextResponse.json({ error: "pending_approval" }, { status: 403 });
		}
		const sessionUserId = toSessionUserId(session.user.id);
		if (!sessionUserId) {
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
				orderBy: [{ createdAt: "asc" }],
			});
		const commentsWithPostAuthorFlag = comments.map((comment) => ({
			...comment,
			isPostAuthor: comment.author.id === post.authorId,
		}));

		return NextResponse.json({ comments: buildCommentTree(commentsWithPostAuthorFlag) });
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
		if (!isSessionUserApproved(session.user.isApproved)) {
			return NextResponse.json({ error: "pending_approval" }, { status: 403 });
		}
		const sessionUserId = toSessionUserId(session.user.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const postId = parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}

		const body = (await request.json()) as {
			content?: unknown;
			parentId?: unknown;
		};
		const content = typeof body.content === "string" ? body.content.trim() : "";
		const normalizedParentId =
			body.parentId === null || body.parentId === undefined
				? null
				: Number(body.parentId);

		if (!content) {
			return NextResponse.json({ error: "Content is required" }, { status: 400 });
		}
		if (
			normalizedParentId !== null &&
			(!Number.isInteger(normalizedParentId) || normalizedParentId <= 0)
		) {
			return NextResponse.json({ error: "Invalid parent comment ID" }, { status: 400 });
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

		if (normalizedParentId !== null) {
			const parentComment = await prisma.comment.findFirst({
				where: {
					id: normalizedParentId,
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
				authorId: sessionUserId,
				parentId: normalizedParentId,
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
					userId: sessionUserId,
					postId,
				},
			},
			update: {
				lastReadCommentCount: commentCount,
				updatedAt: new Date(),
			},
			create: {
				userId: sessionUserId,
				postId,
				lastReadCommentCount: commentCount,
			},
		});

		await prisma.post.update({
			where: { id: postId },
			data: { updatedAt: new Date() },
		});
		safeRevalidateTags(
			getPostMutationTags({
				postId,
				tags: parsePostTags(post.tags),
			})
		);

		const mentionNicknames = extractMentionNicknames(content);
		if (mentionNicknames.length > 0) {
			const mentionTargets = await prisma.user.findMany({
				where: {
					nickname: { in: mentionNicknames },
					deletedAt: null,
				},
				select: {
					id: true,
					nickname: true,
				},
			});

			const targets = mentionTargets.filter((target) => target.id !== sessionUserId);
			if (targets.length > 0) {
				const actorNickname = session.user.nickname || "누군가";
				await prisma.notification.createMany({
					data: targets.map((target) => ({
						userId: target.id,
						actorId: sessionUserId,
						type: "mention_comment",
						message: `${actorNickname}님이 회원님을 멘션했음`,
						postId,
						commentId: comment.id,
					})),
				});

				for (const target of targets) {
					void broadcastRealtime({
						topic: REALTIME_TOPICS.user(target.id),
						event: REALTIME_EVENTS.NOTIFICATION_CREATED,
						payload: {
							type: "mention_comment",
							postId,
							commentId: comment.id,
							actorNickname,
							targetNickname: target.nickname,
						},
					});
				}
			}
		}

		void broadcastRealtime({
			topic: REALTIME_TOPICS.post(postId),
			event: REALTIME_EVENTS.COMMENT_CREATED,
			payload: {
				postId,
				commentId: comment.id,
				parentId: comment.parentId,
				actorUserId: sessionUserId,
				comment: {
					id: comment.id,
					content: comment.content,
					createdAt: comment.createdAt,
					updatedAt: comment.updatedAt,
					isPinned: Boolean(comment.isPinned),
					parentId: comment.parentId,
					isPostAuthor: comment.author.id === post.authorId,
					author: {
						id: comment.author.id,
						nickname: comment.author.nickname,
						minecraftUuid: comment.author.minecraftUuid,
						role: comment.author.role,
					},
				},
			},
		});

		void broadcastRealtime({
			topic: REALTIME_TOPICS.user(sessionUserId),
			event: REALTIME_EVENTS.POST_READ_MARKER_UPDATED,
			payload: {
				postId,
				lastReadCommentCount: commentCount,
				totalCommentCount: commentCount,
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
					isPinned: Boolean(comment.isPinned),
					parentId: comment.parentId,
					author: comment.author,
					isPostAuthor: comment.author.id === post.authorId,
					replies: [],
				},
			});
	} catch (error) {
		console.error("[API] POST /api/posts/[id]/comments error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
