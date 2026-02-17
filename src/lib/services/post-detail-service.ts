import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { buildPostDetailTag } from "@/lib/cache-tags";
import { buildCommentTree } from "@/lib/comments";
import type { Comment as TreeComment } from "@/lib/comment-tree-ops";

const POST_DETAIL_CACHE_VERSION = "v1";
const POST_DETAIL_REVALIDATE_SECONDS = 30;

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
		user_liked: boolean;
	};
	comments: TreeComment[];
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
	post: GetPostDetailResult["post"];
	comments: TreeComment[];
	totalCommentCount: number;
	timing: {
		queryPostMs: number;
		queryLikeMs: number;
		queryCommentsMs: number;
		serializeMs: number;
	};
}

function parseTags(rawTags: string | null): string[] {
	if (!rawTags) {
		return [];
	}
	try {
		const parsed = JSON.parse(rawTags) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter((tag): tag is string => typeof tag === "string");
	} catch {
		return [];
	}
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
		`user:${input.sessionUserId}`,
	];
}

async function getPostDetailCoreUncached(
	input: GetPostDetailInput
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

	const likePromise = (async () => {
		const startedAt = performance.now();
		const data = await prisma.like.findFirst({
			where: {
				postId: post.id,
				userId: input.sessionUserId,
			},
		});
		return { data, ms: performance.now() - startedAt };
	})();

	const commentsPromise = (async () => {
		const startedAt = performance.now();
		const data = await prisma.comment.findMany({
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
			orderBy: [{ createdAt: "asc" }],
		});
		return { data, ms: performance.now() - startedAt };
	})();

	const [likedResult, commentsResult] = await Promise.all([likePromise, commentsPromise]);
	const queryLikeMs = likedResult.ms;
	const comments = commentsResult.data;
	const queryCommentsMs = commentsResult.ms;

	const commentsWithPostAuthorFlag = comments.map((comment) => ({
		...comment,
		isPostAuthor: comment.author.id === post.authorId,
	}));

	const serializeStart = performance.now();
	const responsePost = {
		id: post.id,
		title: post.title,
		content: post.content,
		tags: parseTags(post.tags),
		likes: post.likes,
		views: post.views,
		createdAt: post.createdAt.toISOString(),
		updatedAt: post.updatedAt.toISOString(),
		author_id: post.authorId,
		author_name: post.author.nickname,
		author_uuid: post.author.minecraftUuid,
		user_liked: Boolean(likedResult.data),
	};
	const responseComments = serializeCommentTree(buildCommentTree(commentsWithPostAuthorFlag));
	const serializeMs = performance.now() - serializeStart;

	return {
		post: responsePost,
		comments: responseComments,
		totalCommentCount: comments.length,
		timing: {
			queryPostMs,
			queryLikeMs,
			queryCommentsMs,
			serializeMs,
		},
	};
}

export async function getPostDetail(
	input: GetPostDetailInput
): Promise<GetPostDetailResult | null> {
	const totalStart = performance.now();
	const loadCore =
		process.env.NODE_ENV === "test"
			? async () => getPostDetailCoreUncached(input)
			: unstable_cache(async () => getPostDetailCoreUncached(input), buildPostDetailCacheKey(input), {
					revalidate: POST_DETAIL_REVALIDATE_SECONDS,
					tags: [buildPostDetailTag(input.postId)],
			  });

	let core: CachedPostDetailCoreResult | null;
	try {
		core = await loadCore();
	} catch (error) {
		if (error instanceof Error && error.message.includes("incrementalCache missing")) {
			core = await getPostDetailCoreUncached(input);
		} else {
			throw error;
		}
	}
	if (!core) {
		return null;
	}

	const readStart = performance.now();
	const previousRead = await prisma.postRead.findUnique({
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
	const queryReadMs = performance.now() - readStart;

	const nextReadCount = core.totalCommentCount;
	const shouldSyncRead =
		previousRead?.lastReadCommentCount !== nextReadCount &&
		(previousRead !== null || nextReadCount > 0);

	let writeReadMs = 0;
	if (shouldSyncRead) {
		const writeReadStart = performance.now();
		await prisma.postRead.upsert({
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
		});
		writeReadMs = performance.now() - writeReadStart;
	}

	return {
		post: core.post,
		comments: core.comments,
		readMarker: {
			lastReadCommentCount: previousRead?.lastReadCommentCount ?? 0,
			totalCommentCount: nextReadCount,
		},
		timing: {
			queryPostMs: core.timing.queryPostMs,
			queryLikeMs: core.timing.queryLikeMs,
			queryCommentsMs: core.timing.queryCommentsMs,
			queryReadMs,
			writeReadMs,
			serializeMs: core.timing.serializeMs,
			totalMs: performance.now() - totalStart,
		},
	};
}
