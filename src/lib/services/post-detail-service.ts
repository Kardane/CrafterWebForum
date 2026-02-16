import { prisma } from "@/lib/prisma";
import { buildCommentTree } from "@/lib/comments";
import type { Comment as TreeComment } from "@/lib/comment-tree-ops";

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
		dbPostMs: number;
		dbLikeMs: number;
		dbCommentsMs: number;
		dbReadMs: number;
		dbWriteMs: number;
		serializeMs: number;
		totalMs: number;
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

export async function getPostDetail(
	input: GetPostDetailInput
): Promise<GetPostDetailResult | null> {
	const totalStart = performance.now();

	const dbPostStart = performance.now();
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
	const dbPostMs = performance.now() - dbPostStart;

	if (!post) {
		return null;
	}

	const dbLikeStart = performance.now();
	const userLiked = await prisma.like.findFirst({
		where: {
			postId: post.id,
			userId: input.sessionUserId,
		},
	});
	const dbLikeMs = performance.now() - dbLikeStart;

	const dbCommentsStart = performance.now();
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
		orderBy: [{ createdAt: "asc" }],
	});
	const dbCommentsMs = performance.now() - dbCommentsStart;

	const dbReadStart = performance.now();
	const previousRead = await prisma.postRead.findUnique({
		where: {
			userId_postId: {
				userId: input.sessionUserId,
				postId: post.id,
			},
		},
		select: {
			lastReadCommentCount: true,
		},
	});
	const dbReadMs = performance.now() - dbReadStart;

	const commentsWithPostAuthorFlag = comments.map((comment) => ({
		...comment,
		isPostAuthor: comment.author.id === post.authorId,
	}));

	const nextReadCount = comments.length;
	const shouldSyncRead =
		previousRead?.lastReadCommentCount !== nextReadCount &&
		(previousRead !== null || nextReadCount > 0);

	let dbWriteMs = 0;
	if (shouldSyncRead) {
		const dbWriteStart = performance.now();
		await prisma.postRead.upsert({
			where: {
				userId_postId: {
					userId: input.sessionUserId,
					postId: post.id,
				},
			},
			update: {
				lastReadCommentCount: nextReadCount,
				updatedAt: new Date(),
			},
			create: {
				userId: input.sessionUserId,
				postId: post.id,
				lastReadCommentCount: nextReadCount,
			},
		});
		dbWriteMs = performance.now() - dbWriteStart;
	}

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
		user_liked: Boolean(userLiked),
	};
	const responseComments = serializeCommentTree(buildCommentTree(commentsWithPostAuthorFlag));
	const serializeMs = performance.now() - serializeStart;

	return {
		post: responsePost,
		comments: responseComments,
		readMarker: {
			lastReadCommentCount: previousRead?.lastReadCommentCount ?? 0,
			totalCommentCount: nextReadCount,
		},
		timing: {
			dbPostMs,
			dbLikeMs,
			dbCommentsMs,
			dbReadMs,
			dbWriteMs,
			serializeMs,
			totalMs: performance.now() - totalStart,
		},
	};
}
