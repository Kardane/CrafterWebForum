import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildCommentTree } from "@/lib/comments";
import { isSessionUserApproved, toSessionUserId } from "@/lib/session-user";
import { getPostMutationTags, parsePostTags, safeRevalidateTags } from "@/lib/cache-tags";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";
import { extractMentionNicknames } from "@/lib/mentions";
import { buildDeliveryDedupeKey } from "@/lib/push";

type MentionTarget = {
	id: number;
	nickname: string;
};

const DEFAULT_COMMENT_ROOT_LIMIT = 20;
const MAX_COMMENT_ROOT_LIMIT = 50;

const commentAuthorSelect = {
	id: true,
	nickname: true,
	minecraftUuid: true,
	role: true,
} as const;

const commentIncludeWithAuthor = {
	author: {
		select: commentAuthorSelect,
	},
} as const;

async function queueMentionNotificationsAndDeliveries(params: {
	content: string;
	actorUserId: number;
	actorNickname: string;
	postId: number;
	commentId: number;
}): Promise<MentionTarget[]> {
	const mentionNicknames = extractMentionNicknames(params.content);
	if (mentionNicknames.length === 0) {
		return [];
	}

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

	const targets = mentionTargets.filter((target) => target.id !== params.actorUserId);
	if (targets.length === 0) {
		return [];
	}

	await prisma.notification.createMany({
		data: targets.map((target) => ({
			userId: target.id,
			actorId: params.actorUserId,
			type: "mention_comment",
			message: `${params.actorNickname}님이 회원님을 멘션했음`,
			postId: params.postId,
			commentId: params.commentId,
		})),
	});

	const createdNotifications = await prisma.notification.findMany({
		where: {
			userId: { in: targets.map((target) => target.id) },
			actorId: params.actorUserId,
			type: "mention_comment",
			postId: params.postId,
			commentId: params.commentId,
		},
		select: {
			id: true,
			userId: true,
		},
	});
	if (createdNotifications.length === 0) {
		return targets;
	}

	const subscriptions = await prisma.pushSubscription.findMany({
		where: {
			userId: { in: createdNotifications.map((item) => item.userId) },
			isActive: 1,
		},
		select: {
			id: true,
			userId: true,
		},
	});
	if (subscriptions.length === 0) {
		return targets;
	}

	const notificationMap = new Map<number, number>();
	for (const created of createdNotifications) {
		notificationMap.set(created.userId, created.id);
	}

	const queuedAt = new Date();
	const deliveries = subscriptions.flatMap((subscription) => {
		const notificationId = notificationMap.get(subscription.userId);
		if (!notificationId) {
			return [];
		}
		return [
			{
				notificationId,
				userId: subscription.userId,
				subscriptionId: subscription.id,
				channel: "web_push",
				status: "queued",
				nextAttemptAt: queuedAt,
				dedupeKey: buildDeliveryDedupeKey(notificationId, "web_push", subscription.id),
			},
		];
	});

	if (deliveries.length > 0) {
		await prisma.notificationDelivery.createMany({
			data: deliveries,
		});
	}

	return targets;
}

/**
 * GET /api/posts/[id]/comments
 * 댓글 목록 조회 (대댓글 포함)
 */
export async function GET(
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

		const post = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
		});

		if (!post) {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}

		const searchParams = new URL(request.url).searchParams;
		const rawLimit = searchParams.get("limit");
		const rawCursor = searchParams.get("cursor");
		const usePagination = rawLimit !== null || rawCursor !== null;

		if (!usePagination) {
			const comments = await prisma.comment.findMany({
				where: {
					postId,
				},
				include: commentIncludeWithAuthor,
				orderBy: [{ createdAt: "asc" }],
			});
			const commentsWithPostAuthorFlag = comments.map((comment) => ({
				...comment,
				isPostAuthor: comment.author.id === post.authorId,
			}));

			return NextResponse.json({ comments: buildCommentTree(commentsWithPostAuthorFlag) });
		}

		const parsedLimit = rawLimit === null ? DEFAULT_COMMENT_ROOT_LIMIT : Number.parseInt(rawLimit, 10);
		if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
			return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
		}
		const limit = Math.min(parsedLimit, MAX_COMMENT_ROOT_LIMIT);

		let cursor: number | null = null;
		if (rawCursor !== null) {
			const parsedCursor = Number.parseInt(rawCursor, 10);
			if (!Number.isInteger(parsedCursor) || parsedCursor <= 0) {
				return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
			}
			cursor = parsedCursor;
		}

		const rootComments = await prisma.comment.findMany({
			where: {
				postId,
				parentId: null,
				...(cursor ? { id: { lt: cursor } } : {}),
			},
			include: commentIncludeWithAuthor,
			orderBy: [{ id: "desc" }],
			take: limit + 1,
		});

		const hasMore = rootComments.length > limit;
		const selectedRoots = hasMore ? rootComments.slice(0, limit) : rootComments;
		const nextCursor =
			hasMore && selectedRoots.length > 0
				? selectedRoots[selectedRoots.length - 1].id
				: null;

		const commentsById = new Map<number, (typeof selectedRoots)[number]>();
		for (const root of selectedRoots) {
			commentsById.set(root.id, root);
		}

		let frontierIds = selectedRoots.map((comment) => comment.id);
		while (frontierIds.length > 0) {
			const children = await prisma.comment.findMany({
				where: {
					postId,
					parentId: { in: frontierIds },
				},
				include: commentIncludeWithAuthor,
				orderBy: [{ id: "asc" }],
			});
			const nextFrontier: number[] = [];
			for (const child of children) {
				if (commentsById.has(child.id)) {
					continue;
				}
				commentsById.set(child.id, child);
				nextFrontier.push(child.id);
			}
			frontierIds = nextFrontier;
		}

		const pagedComments = Array.from(commentsById.values()).sort((a, b) => a.id - b.id);
		const commentsWithPostAuthorFlag = pagedComments.map((comment) => ({
			...comment,
			isPostAuthor: comment.author.id === post.authorId,
		}));

		return NextResponse.json({
			comments: buildCommentTree(commentsWithPostAuthorFlag),
			page: {
				limit,
				nextCursor,
				hasMore,
			},
		});
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
			include: commentIncludeWithAuthor,
		});

		const commentCount = await prisma.comment.count({
			where: { postId },
		});

		await prisma.$transaction([
			prisma.postRead.upsert({
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
			}),
			prisma.post.update({
				where: { id: postId },
				data: { updatedAt: new Date() },
			}),
		]);
		safeRevalidateTags(
			getPostMutationTags({
				postId,
				tags: parsePostTags(post.tags),
			})
		);

		const actorNickname = session.user.nickname || "누군가";
		const mentionTargets = await queueMentionNotificationsAndDeliveries({
			content,
			actorUserId: sessionUserId,
			actorNickname,
			postId,
			commentId: comment.id,
		});

		for (const target of mentionTargets) {
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
