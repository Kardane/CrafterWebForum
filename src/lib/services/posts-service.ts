import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { getPostListCacheTags } from "@/lib/cache-tags";
import { extractFirstImage, getPreviewText } from "@/lib/utils";
import {
	OMBUDSMAN_BOARD_MARKER,
	type PostBoardType,
	normalizeBoardType,
	parsePostTagMetadata,
} from "@/lib/post-board";
import { isMissingLegacyPostListColumnError, isMissingPostSubscriptionTableError } from "@/lib/db-schema-guard";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const POSTS_LIST_CACHE_VERSION = "v2";
const POSTS_LIST_REVALIDATE_SECONDS = 30;

export interface ListPostsInput {
	page?: number;
	limit?: number;
	tag?: string | null;
	board?: PostBoardType | null;
	sort?: string | null;
	search?: string | null;
	searchInComments?: boolean;
	sessionUserId?: number | null;
	includeUserOverlay?: boolean;
	skipExactTotal?: boolean;
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
		board: PostBoardType;
		serverAddress: string | null;
		unreadCount: number;
		userLiked: boolean;
		userSubscribed: boolean;
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
	board: PostBoardType;
	sort: string;
	search: string;
	searchInComments: boolean;
	sessionUserId: number | null;
	includeUserOverlay: boolean;
	skipExactTotal: boolean;
}

interface NormalizedListPostsCoreInput {
	page: number;
	limit: number;
	tag: string | null;
	board: PostBoardType;
		sort: string;
		search: string;
		searchInComments: boolean;
		skipExactTotal: boolean;
}

interface CachedListPostCore {
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
	board: PostBoardType;
	serverAddress: string | null;
}

interface CachedListPostsCoreResult {
	posts: CachedListPostCore[];
	metadata: ListPostsResult["metadata"];
	timing: {
		queryMainMs: number;
		serializeMs: number;
		totalMs: number;
	};
}

interface LegacyListPostRow {
	id: number;
	title: string;
	content: string;
	tags: string | null;
	likes: number;
	views: number;
	createdAt: Date;
	updatedAt: Date;
	author: { nickname: string; minecraftUuid: string | null };
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

function resolveOrderBy(sort: string | null | undefined) {
	switch (sort) {
		case "oldest":
			return { createdAt: "asc" } satisfies Prisma.PostOrderByWithRelationInput;
		case "likes":
			return [{ likes: "desc" }, { createdAt: "desc" }] satisfies Prisma.PostOrderByWithRelationInput[];
		case "comments":
			return { commentCount: "desc" } satisfies Prisma.PostOrderByWithRelationInput;
		case "activity":
		default:
			return { updatedAt: "desc" } satisfies Prisma.PostOrderByWithRelationInput;
	}
}

function resolveLegacyOrderBy(sort: string | null | undefined) {
	switch (sort) {
		case "oldest":
			return { createdAt: "asc" } satisfies Prisma.PostOrderByWithRelationInput;
		case "likes":
			return [{ likes: "desc" }, { createdAt: "desc" }] satisfies Prisma.PostOrderByWithRelationInput[];
		case "comments":
		case "activity":
		default:
			return { updatedAt: "desc" } satisfies Prisma.PostOrderByWithRelationInput;
	}
}

function normalizeListPostsInput(input: ListPostsInput): NormalizedListPostsInput {
	const page = normalizePositiveInt(input.page, DEFAULT_PAGE);
	const limit = normalizePositiveInt(input.limit, DEFAULT_LIMIT, MAX_LIMIT);
	const tag = input.tag?.trim() || null;
	const board = normalizeBoardType(input.board);
	const search = input.search?.trim() ?? "";
	const sort = input.sort ?? "activity";
	return {
		page,
		limit,
		tag,
		board,
		sort,
		search,
		searchInComments: input.searchInComments ?? false,
		sessionUserId: input.sessionUserId ?? null,
		includeUserOverlay: input.includeUserOverlay ?? true,
		skipExactTotal: input.skipExactTotal ?? false,
	};
}

function toCoreInput(input: NormalizedListPostsInput): NormalizedListPostsCoreInput {
	return {
		page: input.page,
		limit: input.limit,
		tag: input.tag,
		board: input.board,
		sort: input.sort,
		search: input.search,
		searchInComments: input.searchInComments,
		skipExactTotal: input.skipExactTotal,
	};
}

function buildListPostsCacheKey(input: NormalizedListPostsCoreInput) {
	return [
		`posts:list:${POSTS_LIST_CACHE_VERSION}`,
		`page:${input.page}`,
		`limit:${input.limit}`,
		`tag:${input.tag ?? "all"}`,
		`board:${input.board}`,
		`sort:${input.sort}`,
		`search:${encodeURIComponent(input.search)}`,
		`searchInComments:${input.searchInComments ? "1" : "0"}`,
	];
}

function buildBaseConditions(input: NormalizedListPostsCoreInput): Prisma.PostWhereInput[] {
	const andConditions: Prisma.PostWhereInput[] = [{ deletedAt: null }];

	if (input.tag) {
		andConditions.push({
			tags: {
				contains: `"${input.tag}"`,
			},
		});
	}

	if (input.search.length > 0) {
		const searchConditions: Prisma.PostWhereInput[] = [
			{ title: { contains: input.search } },
			{ content: { contains: input.search } },
		];
		if (input.searchInComments) {
			searchConditions.push({ comments: { some: { content: { contains: input.search } } } });
		}
		andConditions.push({
			OR: searchConditions,
		});
	}

	return andConditions;
}

function buildBoardCondition(board: PostBoardType): Prisma.PostWhereInput {
	if (board === "sinmungo") {
		return {
			OR: [{ board: "sinmungo" }, { tags: { contains: `"${OMBUDSMAN_BOARD_MARKER}"` } }],
		};
	}

	return {
		NOT: {
			OR: [{ board: "sinmungo" }, { tags: { contains: `"${OMBUDSMAN_BOARD_MARKER}"` } }],
		},
	};
}

function buildLegacyBoardCondition(board: PostBoardType): Prisma.PostWhereInput {
	if (board === "sinmungo") {
		return {
			tags: { contains: `"${OMBUDSMAN_BOARD_MARKER}"` },
		};
	}

	return {
		OR: [{ tags: null }, { tags: { not: { contains: `"${OMBUDSMAN_BOARD_MARKER}"` } } }],
	};
}

function composeWhereCondition(
	baseConditions: Prisma.PostWhereInput[],
	boardCondition: Prisma.PostWhereInput
): Prisma.PostWhereInput {
	const andConditions = [...baseConditions, boardCondition];
	return andConditions.length === 1 ? andConditions[0] : { AND: andConditions };
}

async function loadCommentCountByPostId(postIds: number[]) {
	if (postIds.length === 0) {
		return new Map<number, number>();
	}

	const rows = await prisma.comment.groupBy({
		by: ["postId"],
		where: {
			postId: {
				in: postIds,
			},
		},
		_count: {
			_all: true,
		},
	});

	return new Map(rows.map((row) => [row.postId, row._count._all]));
}

async function loadLegacyPostsCore(
	input: NormalizedListPostsCoreInput,
	whereCondition: Prisma.PostWhereInput,
	skip: number,
	limit: number
) {
	const orderBy = resolveLegacyOrderBy(input.sort);
	let total: number;

	if (input.sort === "comments") {
		const allRows = await prisma.post.findMany({
			where: whereCondition,
			orderBy,
			select: {
				id: true,
				title: true,
				content: true,
				tags: true,
				likes: true,
				views: true,
				createdAt: true,
				updatedAt: true,
				author: {
					select: {
						nickname: true,
						minecraftUuid: true,
					},
				},
			},
		});
		const commentCountByPostId = await loadCommentCountByPostId(allRows.map((row) => row.id));
		const sortedRows = [...allRows].sort((left, right) => {
			const countDiff = (commentCountByPostId.get(right.id) ?? 0) - (commentCountByPostId.get(left.id) ?? 0);
			if (countDiff !== 0) {
				return countDiff;
			}
			return right.createdAt.getTime() - left.createdAt.getTime();
		});

		return {
			rows: sortedRows.slice(skip, skip + limit),
			total: allRows.length,
			commentCountByPostId,
		};
	}

	const rows: LegacyListPostRow[] = await prisma.post.findMany({
		where: whereCondition,
		take: limit,
		skip,
		orderBy,
		select: {
			id: true,
			title: true,
			content: true,
			tags: true,
			likes: true,
			views: true,
			createdAt: true,
			updatedAt: true,
			author: {
				select: {
					nickname: true,
					minecraftUuid: true,
				},
			},
		},
	});

	if (input.skipExactTotal) {
		const hasMore = rows.length === limit;
		total = hasMore ? input.page * limit + 1 : skip + rows.length;
	} else {
		total = await prisma.post.count({ where: whereCondition });
	}

	return {
		rows,
		total,
		commentCountByPostId: await loadCommentCountByPostId(rows.map((row) => row.id)),
	};
}

async function listPostsCoreUncached(
	input: NormalizedListPostsCoreInput
): Promise<CachedListPostsCoreResult> {
	const totalStart = performance.now();
	const page = input.page;
	const limit = input.limit;
	const skip = (page - 1) * limit;
	const baseConditions = buildBaseConditions(input);
	const whereCondition = composeWhereCondition(baseConditions, buildBoardCondition(input.board));
	const legacyWhereCondition = composeWhereCondition(baseConditions, buildLegacyBoardCondition(input.board));

	const orderBy = resolveOrderBy(input.sort);

	const queryMainStart = performance.now();
	let posts: Array<{
		id: number;
		title: string;
		content: string;
		tags: string | null;
		board: string | null;
		serverAddress: string | null;
		likes: number;
		views: number;
		createdAt: Date;
		updatedAt: Date;
		commentCount: number;
		author: { nickname: string; minecraftUuid: string | null };
	}>;
	let total: number;
	try {
		posts = await prisma.post.findMany({
			where: whereCondition,
			take: limit,
			skip,
			orderBy,
			select: {
				id: true,
				title: true,
				content: true,
				tags: true,
				board: true,
				serverAddress: true,
				likes: true,
				views: true,
				createdAt: true,
				updatedAt: true,
				commentCount: true,
				author: {
					select: {
						nickname: true,
						minecraftUuid: true,
					},
				},
			},
		});
		if (input.skipExactTotal) {
			const hasMore = posts.length === limit;
			total = hasMore ? page * limit + 1 : skip + posts.length;
		} else {
			total = await prisma.post.count({ where: whereCondition });
		}
	} catch (error) {
		if (!isMissingLegacyPostListColumnError(error)) {
			throw error;
		}
		console.warn("[posts-service] legacy post columns missing; using tag/comment fallback");
		const legacyResult = await loadLegacyPostsCore(input, legacyWhereCondition, skip, limit);
		posts = legacyResult.rows.map((row) => ({
			...row,
			board: null,
			serverAddress: null,
			commentCount: legacyResult.commentCountByPostId.get(row.id) ?? 0,
		}));
		total = legacyResult.total;
	}
	const queryMainMs = performance.now() - queryMainStart;

	const serializeStart = performance.now();
	const formattedPosts = posts.map((post) => {
		const metadata = parsePostTagMetadata(post.tags, post.board, post.serverAddress);
		return {
			id: post.id,
			title: post.title,
			preview: getPreviewText(post.content),
			thumbnailUrl: extractFirstImage(post.content),
			tags: metadata.tags,
			board: normalizeBoardType(post.board ?? metadata.board),
			serverAddress: post.serverAddress ?? metadata.serverAddress,
			likes: post.likes,
			views: post.views,
			createdAt: post.createdAt.toISOString(),
			updatedAt: post.updatedAt.toISOString(),
			authorName: post.author.nickname,
			authorUuid: post.author.minecraftUuid,
			commentCount: post.commentCount,
		};
	});
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
			serializeMs,
			totalMs: performance.now() - totalStart,
		},
	};
}

export async function listPosts(input: ListPostsInput): Promise<ListPostsResult> {
	const totalStart = performance.now();
	const normalizedInput = normalizeListPostsInput(input);
	const coreInput = toCoreInput(normalizedInput);
	let core: CachedListPostsCoreResult;
	if (process.env.NODE_ENV === "test") {
		core = await listPostsCoreUncached(coreInput);
	} else {
		const cachedListPosts = unstable_cache(
			async () => listPostsCoreUncached(coreInput),
			buildListPostsCacheKey(coreInput),
			{
				revalidate: POSTS_LIST_REVALIDATE_SECONDS,
				tags: getPostListCacheTags(coreInput.tag),
			}
		);
		try {
			core = await cachedListPosts();
		} catch (error) {
			if (error instanceof Error && error.message.includes("incrementalCache missing")) {
				core = await listPostsCoreUncached(coreInput);
			} else {
				throw error;
			}
		}
	}

	const sessionUserId = normalizedInput.sessionUserId;
	const postIds = core.posts.map((post) => post.id);
	let queryAuxMs = 0;
	let likedPostIdSet = new Set<number>();
	let subscribedPostIdSet = new Set<number>();
	let readCountByPostId = new Map<number, number>();
	const shouldLoadUserOverlay = normalizedInput.includeUserOverlay;
	const shouldLoadLikeOverlay = shouldLoadUserOverlay && Boolean(sessionUserId) && postIds.length > 0;
	const shouldLoadReadOverlay = shouldLoadLikeOverlay;
	const shouldLoadSubscriptionOverlay = shouldLoadLikeOverlay;

	if (shouldLoadLikeOverlay && sessionUserId) {
		const queryAuxStart = performance.now();
		const likesPromise = prisma.like.findMany({
			where: {
				userId: sessionUserId,
				postId: { in: postIds },
			},
			select: { postId: true },
		});
		const readsPromise = shouldLoadReadOverlay
			? prisma.postRead.findMany({
					where: {
						userId: sessionUserId,
						postId: { in: postIds },
					},
					select: {
						postId: true,
						lastReadCommentCount: true,
					},
			  })
			: Promise.resolve([] as Array<{ postId: number; lastReadCommentCount: number }>);
		const [likes, reads] = await Promise.all([
			likesPromise,
			readsPromise,
		]);
		likedPostIdSet = new Set(likes.map((like) => like.postId));
		if (shouldLoadReadOverlay) {
			readCountByPostId = new Map(
				reads.map((read) => [read.postId, read.lastReadCommentCount])
			);
		}

		if (shouldLoadSubscriptionOverlay) {
			try {
				const subscriptions = await prisma.postSubscription.findMany({
					where: {
						userId: sessionUserId,
						postId: { in: postIds },
					},
					select: { postId: true },
				});
				subscribedPostIdSet = new Set(subscriptions.map((subscription) => subscription.postId));
			} catch (error) {
				if (isMissingPostSubscriptionTableError(error)) {
					console.warn("[posts-service] post subscription table missing; skipping subscription overlay");
				} else {
					throw error;
				}
			}
		}

		queryAuxMs = performance.now() - queryAuxStart;
	}

	const serializeStart = performance.now();
	const posts = core.posts.map((post) => {
		const lastReadCommentCount = shouldLoadReadOverlay ? (readCountByPostId.get(post.id) ?? 0) : 0;
		let unreadCount = 0;
		if (shouldLoadReadOverlay) {
			unreadCount = Math.max(post.commentCount - lastReadCommentCount, 0);
		} else if (normalizedInput.includeUserOverlay) {
			unreadCount = post.commentCount;
		}
		return {
			...post,
			unreadCount,
			userLiked: likedPostIdSet.has(post.id),
			userSubscribed: subscribedPostIdSet.has(post.id),
		};
	});
	const overlaySerializeMs = performance.now() - serializeStart;

	return {
		posts,
		metadata: core.metadata,
		timing: {
			queryMainMs: core.timing.queryMainMs,
			queryAuxMs,
			serializeMs: core.timing.serializeMs + overlaySerializeMs,
			totalMs: performance.now() - totalStart,
		},
	};
}
