import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { buildPostDetailTag } from "@/lib/cache-tags";
import { buildCommentTree } from "@/lib/comments";
import type { Comment as TreeComment } from "@/lib/comment-tree-ops";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";
import { type PostBoardType, parsePostTagMetadata } from "@/lib/post-board";

const POST_DETAIL_CACHE_VERSION = "v1";
const POST_DETAIL_REVALIDATE_SECONDS = 30;
const INITIAL_DETAIL_ROOT_LIMIT = 20;

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

interface GetPostDetailInput {
	postId: number;
	sessionUserId: number;
}

export interface GetPostDetailResult {
	post: {
		id: number;
		title: string;
		content: string;
		tags: string[];
		likes: number;
		views: number;
		createdAt: string;
		updatedAt: string;
		author_id: number;
		author_name: string;
		author_uuid: string | null;
		board: PostBoardType;
		serverAddress: string | null;
		user_liked: boolean;
	};
	comments: TreeComment[];
	commentsPage: {
		limit: number;
		nextCursor: number | null;
		hasMore: boolean;
	};
	readMarker: {
		lastReadCommentCount: number;
		totalCommentCount: number;
	};
	timing: {
		queryPostMs: number;
		queryLikeMs: number;
		queryCommentsMs: number;
		queryReadMs: number;
		writeReadMs: number;
		serializeMs: number;
		totalMs: number;
	};
}

interface CachedPostDetailCoreResult {
	post: Omit<GetPostDetailResult["post"], "user_liked">;
	comments: TreeComment[];
	commentsPage: GetPostDetailResult["commentsPage"];
	totalCommentCount: number;
	timing: {
		queryPostMs: number;
		queryCommentsMs: number;
		serializeMs: number;
	};
}

async function loadInitialDetailCommentThreads(input: {
	postId: number;
	postAuthorId: number;
	totalCommentCount: number;
	rootLimit: number;
}): Promise<{
	comments: TreeComment[];
	commentsPage: GetPostDetailResult["commentsPage"];
	totalCommentCount: number;
	queryCommentsMs: number;
}> {
	const startedAt = performance.now();
	const rootComments = await prisma.comment.findMany({
		where: {
			postId: input.postId,
			parentId: null,
		},
		include: commentIncludeWithAuthor,
		orderBy: [{ id: "desc" }],
		take: input.rootLimit + 1,
	});

	const hasMore = rootComments.length > input.rootLimit;
	const selectedRoots = hasMore ? rootComments.slice(0, input.rootLimit) : rootComments;
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
				postId: input.postId,
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
		isPostAuthor: comment.author.id === input.postAuthorId,
	}));

	return {
		comments: serializeCommentTree(buildCommentTree(commentsWithPostAuthorFlag)),
		commentsPage: {
			limit: input.rootLimit,
			nextCursor,
			hasMore,
		},
		totalCommentCount: input.totalCommentCount,
		queryCommentsMs: performance.now() - startedAt,
	};
}

function serializeCommentTree(nodes: ReturnType<typeof buildCommentTree>): TreeComment[] {
	return nodes.map((node) => ({
		id: node.id,
		content: node.content,
		createdAt: node.createdAt.toISOString(),
		updatedAt: node.updatedAt.toISOString(),
		isPinned: node.isPinned,
		parentId: node.parentId,
		author: {
			id: node.author.id,
			nickname: node.author.nickname,
			minecraftUuid: node.author.minecraftUuid,
			role: node.author.role,
		},
		isPostAuthor: node.isPostAuthor,
		replies: serializeCommentTree(node.replies),
	}));
}

function buildPostDetailCacheKey(input: GetPostDetailInput) {
	return [
		`posts:detail:${POST_DETAIL_CACHE_VERSION}`,
		`post:${input.postId}`,
	];
}

async function getPostDetailCoreUncached(
	input: Pick<GetPostDetailInput, "postId">
): Promise<CachedPostDetailCoreResult | null> {
	const queryPostStart = performance.now();
	const post = await prisma.post.findFirst({
		where: {
			id: input.postId,
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
	const queryPostMs = performance.now() - queryPostStart;

	if (!post) {
		return null;
	}

	const commentsResult = await loadInitialDetailCommentThreads({
		postId: post.id,
		postAuthorId: post.authorId,
		totalCommentCount: post.commentCount,
		rootLimit: INITIAL_DETAIL_ROOT_LIMIT,
	});
	const queryCommentsMs = commentsResult.queryCommentsMs;
	const postTagMetadata = parsePostTagMetadata(post.tags);

	const serializeStart = performance.now();
	const responsePost = {
		id: post.id,
		title: post.title,
		content: post.content,
		tags: postTagMetadata.tags,
		likes: post.likes,
		views: post.views,
		createdAt: post.createdAt.toISOString(),
		updatedAt: post.updatedAt.toISOString(),
		author_id: post.authorId,
		author_name: post.author.nickname,
		author_uuid: post.author.minecraftUuid,
		board: postTagMetadata.board,
		serverAddress: postTagMetadata.serverAddress,
	};
	const responseComments = commentsResult.comments;
	const serializeMs = performance.now() - serializeStart;

	return {
		post: responsePost,
		comments: responseComments,
		commentsPage: commentsResult.commentsPage,
		totalCommentCount: commentsResult.totalCommentCount,
		timing: {
			queryPostMs,
			queryCommentsMs,
			serializeMs,
		},
	};
}

export async function getPostDetail(
	input: GetPostDetailInput
): Promise<GetPostDetailResult | null> {
	const totalStart = performance.now();
	const likeStart = performance.now();
	const likePromise = prisma.like.findFirst({
		where: {
			postId: input.postId,
			userId: input.sessionUserId,
		},
		select: {
			id: true,
		},
	});

	const readStart = performance.now();
	const readPromise = prisma.postRead.findUnique({
		where: {
			userId_postId: {
				userId: input.sessionUserId,
				postId: input.postId,
			},
		},
		select: {
			lastReadCommentCount: true,
		},
	});

	const coreInput = { postId: input.postId };
	const loadCore =
		process.env.NODE_ENV === "test"
			? async () => getPostDetailCoreUncached(coreInput)
			: unstable_cache(async () => getPostDetailCoreUncached(coreInput), buildPostDetailCacheKey(input), {
					revalidate: POST_DETAIL_REVALIDATE_SECONDS,
					tags: [buildPostDetailTag(input.postId)],
			  });

	let core: CachedPostDetailCoreResult | null;
	try {
		core = await loadCore();
	} catch (error) {
		if (error instanceof Error && error.message.includes("incrementalCache missing")) {
			core = await getPostDetailCoreUncached(coreInput);
		} else {
			throw error;
		}
	}
	if (!core) {
		return null;
	}

	const [liked, previousRead] = await Promise.all([likePromise, readPromise]);
	const queryLikeMs = performance.now() - likeStart;
	const queryReadMs = performance.now() - readStart;

	const nextReadCount = core.totalCommentCount;
	const shouldSyncRead =
		previousRead?.lastReadCommentCount !== nextReadCount &&
		(previousRead !== null || nextReadCount > 0);

	let writeReadMs = 0;
	if (shouldSyncRead) {
		const writeReadStart = performance.now();
		void prisma.postRead
			.upsert({
				where: {
					userId_postId: {
						userId: input.sessionUserId,
						postId: input.postId,
					},
				},
				update: {
					lastReadCommentCount: nextReadCount,
					updatedAt: new Date(),
				},
				create: {
					userId: input.sessionUserId,
					postId: input.postId,
					lastReadCommentCount: nextReadCount,
				},
			})
			.then(() => {
				void broadcastRealtime({
					topic: REALTIME_TOPICS.user(input.sessionUserId),
					event: REALTIME_EVENTS.POST_READ_MARKER_UPDATED,
					payload: {
						postId: input.postId,
						lastReadCommentCount: nextReadCount,
						totalCommentCount: nextReadCount,
					},
				});
			})
			.catch((error) => {
				console.error("[post-detail] async postRead sync failed", error);
			});
		writeReadMs = performance.now() - writeReadStart;
	}

	return {
		post: {
			...core.post,
			user_liked: Boolean(liked),
		},
		comments: core.comments,
		commentsPage: core.commentsPage,
		readMarker: {
			lastReadCommentCount: previousRead?.lastReadCommentCount ?? 0,
			totalCommentCount: nextReadCount,
		},
		timing: {
			queryPostMs: core.timing.queryPostMs,
			queryLikeMs,
			queryCommentsMs: core.timing.queryCommentsMs,
			queryReadMs,
			writeReadMs,
			serializeMs: core.timing.serializeMs,
			totalMs: performance.now() - totalStart,
		},
	};
}
