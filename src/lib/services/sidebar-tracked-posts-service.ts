import { prisma } from "@/lib/prisma";
import { isMissingPostBoardMetadataColumnError, isMissingPostSubscriptionTableError } from "@/lib/db-schema-guard";
import type { SidebarTrackedPost, SidebarTrackedPostsPage } from "@/types/sidebar";
import { normalizeBoardType, parsePostTagMetadata } from "@/lib/post-board";

const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 50;

interface ListSidebarTrackedPostsInput {
	userId: number;
	limit?: number;
	cursor?: string | null;
}

export interface ListSidebarTrackedPostsResult {
	items: SidebarTrackedPost[];
	page: SidebarTrackedPostsPage;
}

interface ParsedCursor {
	timestampMs: number;
	postId: number;
}

interface ActivityRow {
	id: number;
	title: string;
	board: "develope" | "sinmungo";
	serverAddress: string | null;
	updatedAt: Date;
	authorId: number;
	authorNickname: string;
	authorMinecraftUuid: string | null;
	commentCount: number;
}

function normalizeLimit(value: number | undefined): number {
	if (!Number.isInteger(value) || !value || value <= 0) {
		return DEFAULT_LIMIT;
	}
	return Math.min(value, MAX_LIMIT);
}

function parseCursor(rawCursor: string | null | undefined): ParsedCursor | null {
	if (!rawCursor) {
		return null;
	}
	const matched = rawCursor.match(/^(\d+)_(\d+)$/);
	if (!matched) {
		return null;
	}
	const timestampMs = Number.parseInt(matched[1] ?? "", 10);
	const postId = Number.parseInt(matched[2] ?? "", 10);
	if (!Number.isInteger(timestampMs) || timestampMs <= 0) {
		return null;
	}
	if (!Number.isInteger(postId) || postId <= 0) {
		return null;
	}
	return {
		timestampMs,
		postId,
	};
}

function encodeCursor(row: ActivityRow): string {
	return `${row.updatedAt.getTime()}_${row.id}`;
}

function compareActivityDesc(a: ActivityRow, b: ActivityRow): number {
	const aTime = a.updatedAt.getTime();
	const bTime = b.updatedAt.getTime();
	if (aTime !== bTime) {
		return bTime - aTime;
	}
	return b.id - a.id;
}

function isAfterCursor(row: ActivityRow, cursor: ParsedCursor): boolean {
	const rowTime = row.updatedAt.getTime();
	if (rowTime < cursor.timestampMs) {
		return true;
	}
	if (rowTime > cursor.timestampMs) {
		return false;
	}
	return row.id < cursor.postId;
}

function emptyResult(limit: number): ListSidebarTrackedPostsResult {
	return {
		items: [],
		page: {
			limit,
			nextCursor: null,
			hasMore: false,
		},
	};
}

export async function listSidebarTrackedPosts(
	input: ListSidebarTrackedPostsInput
): Promise<ListSidebarTrackedPostsResult> {
	const limit = normalizeLimit(input.limit);
	const parsedCursor = parseCursor(input.cursor);

	let subscribedRows: Array<{ postId: number }> = [];
	try {
		subscribedRows = await prisma.postSubscription.findMany({
			where: {
				userId: input.userId,
				post: {
					deletedAt: null,
				},
			},
			select: {
				postId: true,
			},
		});
	} catch (error) {
		if (isMissingPostSubscriptionTableError(error)) {
			console.warn("[sidebar-tracked-posts] post subscription table missing; returning empty subscription list");
		} else {
			throw error;
		}
	}

	const subscribedSet = new Set(subscribedRows.map((row) => row.postId));
	const subscribedPostIdList = Array.from(subscribedSet);

	if (subscribedPostIdList.length === 0) {
		return emptyResult(limit);
	}

	let activityRows;
	try {
		activityRows = await prisma.post.findMany({
			where: {
				id: {
					in: subscribedPostIdList,
				},
				deletedAt: null,
			},
			select: {
				id: true,
				title: true,
				board: true,
				serverAddress: true,
				updatedAt: true,
				commentCount: true,
				authorId: true,
				author: {
					select: {
						nickname: true,
						minecraftUuid: true,
					},
				},
			},
		});
	} catch (error) {
		if (!isMissingPostBoardMetadataColumnError(error)) {
			throw error;
		}
		console.warn("[sidebar-tracked-posts] post board columns missing; using legacy tag metadata fallback");
		activityRows = (await prisma.post.findMany({
			where: {
				id: {
					in: subscribedPostIdList,
				},
				deletedAt: null,
			},
			select: {
				id: true,
				title: true,
				updatedAt: true,
				commentCount: true,
				authorId: true,
				tags: true,
				author: {
					select: {
						nickname: true,
						minecraftUuid: true,
					},
				},
			},
		})) as Array<{
			id: number;
			title: string;
			updatedAt: Date;
			commentCount: number;
			authorId: number;
			tags: string | null;
			author: { nickname: string; minecraftUuid: string | null };
		}>;
	}

	if (activityRows.length === 0) {
		return emptyResult(limit);
	}

	const normalizedActivityRows: ActivityRow[] = activityRows.map((row) => {
		const metadata = parsePostTagMetadata("tags" in row ? row.tags : null, "board" in row ? row.board : null, "serverAddress" in row ? row.serverAddress : null);
		return ({
		id: row.id,
		title: row.title,
		board: metadata.board,
		serverAddress: metadata.serverAddress,
		updatedAt: row.updatedAt,
		authorId: row.authorId,
		authorNickname: row.author.nickname,
		authorMinecraftUuid: row.author.minecraftUuid,
		commentCount: row.commentCount,
		});
	});

	const sortedRows = [...normalizedActivityRows].sort(compareActivityDesc);
	const cursorFilteredRows = parsedCursor ? sortedRows.filter((row) => isAfterCursor(row, parsedCursor)) : sortedRows;
	const pagedRows = cursorFilteredRows.slice(0, limit + 1);
	const hasMore = pagedRows.length > limit;
	const selectedRows = hasMore ? pagedRows.slice(0, limit) : pagedRows;

	if (selectedRows.length === 0) {
		return emptyResult(limit);
	}

	const selectedPostIds = selectedRows.map((row) => row.id);
	const latestCommentRows = await prisma.comment.groupBy({
		by: ["postId"],
		where: {
			postId: {
				in: selectedPostIds,
			},
		},
		_max: {
			id: true,
		},
	});
	const latestCommentIdByPostId = new Map<number, number | null>(
		latestCommentRows.map((row) => [row.postId, row._max.id ?? null])
	);

	const readRows = await prisma.postRead.findMany({
		where: {
			userId: input.userId,
			postId: {
				in: selectedPostIds,
			},
		},
		select: {
			postId: true,
			updatedAt: true,
		},
	});
	const readAtByPostId = new Map(readRows.map((row) => [row.postId, row.updatedAt]));

	const newCommentCountPairs = await Promise.all(
		selectedRows.map(async (row) => {
			const lastReadAt = readAtByPostId.get(row.id);
			const count = await prisma.comment.count({
				where: {
					postId: row.id,
					authorId: {
						not: input.userId,
					},
					...(lastReadAt
						? {
							createdAt: {
								gt: lastReadAt,
							},
						}
						: {}),
				},
			});
			return [row.id, count] as const;
		})
	);
	const newCommentCountByPostId = new Map(newCommentCountPairs);

	const items: SidebarTrackedPost[] = selectedRows.map((row) => ({
		postId: row.id,
		title: row.title,
		href: `/posts/${row.id}`,
		board: row.board,
		serverAddress: row.serverAddress,
		lastActivityAt: row.updatedAt.toISOString(),
		author: {
			nickname: row.authorNickname,
			minecraftUuid: row.authorMinecraftUuid,
		},
		sourceFlags: {
			authored: row.authorId === input.userId,
			subscribed: true,
		},
		isSubscribed: true,
		commentCount: row.commentCount,
		newCommentCount: newCommentCountByPostId.get(row.id) ?? 0,
		latestCommentId: latestCommentIdByPostId.get(row.id) ?? null,
	}));

	const lastVisibleRow = selectedRows[selectedRows.length - 1] ?? null;
	const nextCursor = hasMore && lastVisibleRow ? encodeCursor(lastVisibleRow) : null;

	return {
		items,
		page: {
			limit,
			nextCursor,
			hasMore,
		},
	};
}
