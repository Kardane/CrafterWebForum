import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { getPostListCacheTags } from "@/lib/cache-tags";
import { extractFirstImage, getPreviewText } from "@/lib/utils";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const POSTS_LIST_CACHE_VERSION = "v1";
const POSTS_LIST_REVALIDATE_SECONDS = 30;

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
		preview: string;
		thumbnailUrl: string | null;
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
		queryMainMs: number;
		queryAuxMs: number;
		serializeMs: number;
		totalMs: number;
	};
}

interface NormalizedListPostsInput {
	page: number;
	limit: number;
	tag: string | null;
	sort: string;
	search: string;
	sessionUserId: number | null;
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

function normalizeListPostsInput(input: ListPostsInput): NormalizedListPostsInput {
	const page = normalizePositiveInt(input.page, DEFAULT_PAGE);
	const limit = normalizePositiveInt(input.limit, DEFAULT_LIMIT, MAX_LIMIT);
	const tag = input.tag?.trim() || null;
	const search = input.search?.trim() ?? "";
	const sort = input.sort ?? "activity";
	return {
		page,
		limit,
		tag,
		sort,
		search,
		sessionUserId: input.sessionUserId ?? null,
	};
}

function buildListPostsCacheKey(input: NormalizedListPostsInput) {
	return [
		`posts:list:${POSTS_LIST_CACHE_VERSION}`,
		`page:${input.page}`,
		`limit:${input.limit}`,
		`tag:${input.tag ?? "all"}`,
		`sort:${input.sort}`,
		`search:${encodeURIComponent(input.search)}`,
		`user:${input.sessionUserId ?? "guest"}`,
	];
}

async function listPostsUncached(input: NormalizedListPostsInput): Promise<ListPostsResult> {
	const totalStart = performance.now();
	const page = input.page;
	const limit = input.limit;
	const tag = input.tag;
	const search = input.search;
	const sessionUserId = input.sessionUserId;
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
	const shouldIncludePostReads = sessionUserId !== null;

	const queryMainStart = performance.now();
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
				...(shouldIncludePostReads
					? {
							postReads: {
								where: {
									userId: sessionUserId as number,
								},
								select: {
									lastReadCommentCount: true,
								},
								take: 1,
							},
						}
					: {}),
			},
		}),
		prisma.post.count({ where: whereCondition }),
	]);
	const queryMainMs = performance.now() - queryMainStart;

	let likedPostIds: number[] = [];
	let queryAuxMs = 0;
	if (sessionUserId && posts.length > 0) {
		const queryAuxStart = performance.now();
		const likes = await prisma.like.findMany({
			where: {
				userId: sessionUserId,
				postId: { in: posts.map((post) => post.id) },
			},
			select: { postId: true },
		});
		queryAuxMs = performance.now() - queryAuxStart;
		likedPostIds = likes.map((like) => like.postId);
	}

	const serializeStart = performance.now();
	const likedPostIdSet = new Set(likedPostIds);
	const formattedPosts = posts.map((post) => ({
		id: post.id,
		title: post.title,
		preview: getPreviewText(post.content),
		thumbnailUrl: extractFirstImage(post.content),
		tags: parseTags(post.tags),
		likes: post.likes,
		views: post.views,
		createdAt: post.createdAt.toISOString(),
		updatedAt: post.updatedAt.toISOString(),
		authorName: post.author.nickname,
		authorUuid: post.author.minecraftUuid,
		commentCount: post._count.comments,
		unreadCount: Math.max(
			post._count.comments -
				("postReads" in post ? post.postReads?.[0]?.lastReadCommentCount ?? 0 : 0),
			0
		),
		userLiked: likedPostIdSet.has(post.id),
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
			queryMainMs,
			queryAuxMs,
			serializeMs,
			totalMs: performance.now() - totalStart,
		},
	};
}

export async function listPosts(input: ListPostsInput): Promise<ListPostsResult> {
	const normalizedInput = normalizeListPostsInput(input);
	if (process.env.NODE_ENV === "test") {
		return listPostsUncached(normalizedInput);
	}

	const cachedListPosts = unstable_cache(
		async () => listPostsUncached(normalizedInput),
		buildListPostsCacheKey(normalizedInput),
		{
			revalidate: POSTS_LIST_REVALIDATE_SECONDS,
			tags: getPostListCacheTags(normalizedInput.tag),
		}
	);
	try {
		return await cachedListPosts();
	} catch (error) {
		if (error instanceof Error && error.message.includes("incrementalCache missing")) {
			return listPostsUncached(normalizedInput);
		}
		throw error;
	}
}
