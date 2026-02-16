import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

export interface ListPostsInput {
	page?: number;
	limit?: number;
	tag?: string | null;
	sort?: string | null;
	search?: string | null;
	sessionUserId?: number | null;
}

export interface ListPostsResult {
	posts: Array<{
		id: number;
		title: string;
		content: string;
		tags: string[];
		likes: number;
		views: number;
		createdAt: string;
		updatedAt: string;
		authorName: string;
		authorUuid: string | null;
		commentCount: number;
		unreadCount: number;
		userLiked: boolean;
	}>;
	metadata: {
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	};
	timing: {
		dbMainMs: number;
		dbLikesMs: number;
		serializeMs: number;
		totalMs: number;
	};
}

function normalizePositiveInt(value: number | undefined, fallback: number, max?: number) {
	if (!Number.isInteger(value) || !value || value <= 0) {
		return fallback;
	}
	if (max && value > max) {
		return max;
	}
	return value;
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

function resolveOrderBy(sort: string | null | undefined) {
	switch (sort) {
		case "oldest":
			return { createdAt: "asc" } satisfies Prisma.PostOrderByWithRelationInput;
		case "likes":
			return [{ likes: "desc" }, { createdAt: "desc" }] satisfies Prisma.PostOrderByWithRelationInput[];
		case "comments":
			return { comments: { _count: "desc" } } satisfies Prisma.PostOrderByWithRelationInput;
		case "activity":
		default:
			return { updatedAt: "desc" } satisfies Prisma.PostOrderByWithRelationInput;
	}
}

export async function listPosts(input: ListPostsInput): Promise<ListPostsResult> {
	const totalStart = performance.now();
	const page = normalizePositiveInt(input.page, DEFAULT_PAGE);
	const limit = normalizePositiveInt(input.limit, DEFAULT_LIMIT, MAX_LIMIT);
	const tag = input.tag?.trim() || null;
	const search = input.search?.trim() ?? "";
	const sessionUserId = input.sessionUserId ?? null;
	const skip = (page - 1) * limit;

	const whereCondition: Prisma.PostWhereInput = {
		deletedAt: null,
	};

	if (tag) {
		whereCondition.tags = {
			contains: `"${tag}"`,
		};
	}

	if (search.length > 0) {
		whereCondition.OR = [
			{ title: { contains: search } },
			{ content: { contains: search } },
			{ comments: { some: { content: { contains: search } } } },
		];
	}

	const orderBy = resolveOrderBy(input.sort);

	const dbMainStart = performance.now();
	const [posts, total] = await prisma.$transaction([
		prisma.post.findMany({
			where: whereCondition,
			take: limit,
			skip,
			orderBy,
			include: {
				author: {
					select: {
						nickname: true,
						minecraftUuid: true,
					},
				},
				_count: {
					select: {
						comments: true,
					},
				},
				postReads: {
					where: {
						userId: sessionUserId ?? -1,
					},
					select: {
						lastReadCommentCount: true,
					},
					take: 1,
				},
			},
		}),
		prisma.post.count({ where: whereCondition }),
	]);
	const dbMainMs = performance.now() - dbMainStart;

	let likedPostIds: number[] = [];
	let dbLikesMs = 0;
	if (sessionUserId) {
		const dbLikesStart = performance.now();
		const likes = await prisma.like.findMany({
			where: {
				userId: sessionUserId,
				postId: { in: posts.map((post) => post.id) },
			},
			select: { postId: true },
		});
		dbLikesMs = performance.now() - dbLikesStart;
		likedPostIds = likes.map((like) => like.postId);
	}

	const serializeStart = performance.now();
	const formattedPosts = posts.map((post) => ({
		id: post.id,
		title: post.title,
		content: post.content,
		tags: parseTags(post.tags),
		likes: post.likes,
		views: post.views,
		createdAt: post.createdAt.toISOString(),
		updatedAt: post.updatedAt.toISOString(),
		authorName: post.author.nickname,
		authorUuid: post.author.minecraftUuid,
		commentCount: post._count.comments,
		unreadCount: Math.max(
			post._count.comments - (post.postReads?.[0]?.lastReadCommentCount ?? 0),
			0
		),
		userLiked: likedPostIds.includes(post.id),
	}));
	const serializeMs = performance.now() - serializeStart;

	return {
		posts: formattedPosts,
		metadata: {
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		},
		timing: {
			dbMainMs,
			dbLikesMs,
			serializeMs,
			totalMs: performance.now() - totalStart,
		},
	};
}
