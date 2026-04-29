import type { Prisma } from "@prisma/client";
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

type PostActivityRow = {
	id: number;
	title: string;
	board?: string | null;
	serverAddress?: string | null;
	tags?: string | null;
	updatedAt: Date;
	authorId: number;
	commentCount: number;
	author: { nickname: string; minecraftUuid: string | null };
};

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

function buildTrackedPostWhere(userId: number, parsedCursor: ParsedCursor | null): Prisma.PostWhereInput {
	const conditions: Prisma.PostWhereInput[] = [
		{
			deletedAt: null,
			subscriptions: {
				some: {
					userId,
				},
			},
		},
	];
	if (parsedCursor) {
		const cursorDate = new Date(parsedCursor.timestampMs);
		conditions.push({
			OR: [
				{ updatedAt: { lt: cursorDate } },
				{
					updatedAt: cursorDate,
					id: { lt: parsedCursor.postId },
				},
			],
		});
	}
	return conditions.length === 1 ? conditions[0] : { AND: conditions };
}

async function loadTrackedActivityRows(input: {
	userId: number;
	parsedCursor: ParsedCursor | null;
	limit: number;
}): Promise<PostActivityRow[]> {
	const where = buildTrackedPostWhere(input.userId, input.parsedCursor);
	try {
		return await prisma.post.findMany({
			where,
			orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
			take: input.limit + 1,
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
		if (isMissingPostSubscriptionTableError(error)) {
			return [];
		}
		if (!isMissingPostBoardMetadataColumnError(error)) {
			throw error;
		}
		return await prisma.post.findMany({
			where,
			orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
			take: input.limit + 1,
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
		});
	}
}

async function loadNewCommentCountByPostId(input: {
	rows: ActivityRow[];
	readAtByPostId: Map<number, Date>;
	userId: number;
}) {
	const unreadConditions = input.rows.map((row) => {
		const lastReadAt = input.readAtByPostId.get(row.id);
		return {
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
		};
	});
	if (unreadConditions.length === 0) {
		return new Map<number, number>();
	}
	const rows = await prisma.comment.groupBy({
		by: ["postId"],
		where: {
			OR: unreadConditions,
		},
		_count: {
			_all: true,
		},
	});
	return new Map(rows.map((row) => [row.postId, row._count._all]));
}

export async function listSidebarTrackedPosts(
	input: ListSidebarTrackedPostsInput
): Promise<ListSidebarTrackedPostsResult> {
	const limit = normalizeLimit(input.limit);
	const parsedCursor = parseCursor(input.cursor);

	const activityRows = await loadTrackedActivityRows({
		userId: input.userId,
		parsedCursor,
		limit,
	});

	if (activityRows.length === 0) {
		return emptyResult(limit);
	}

	const normalizedActivityRows: ActivityRow[] = activityRows.map((row) => {
		const metadata = parsePostTagMetadata(row.tags ?? null, row.board ?? null, row.serverAddress ?? null);
		return {
			id: row.id,
			title: row.title,
			board: metadata.board,
			serverAddress: metadata.serverAddress,
			updatedAt: row.updatedAt,
			authorId: row.authorId,
			authorNickname: row.author.nickname,
			authorMinecraftUuid: row.author.minecraftUuid,
			commentCount: row.commentCount,
		};
	});

	const sortedRows = [...normalizedActivityRows].sort(compareActivityDesc);
	const cursorFilteredRows = parsedCursor ? sortedRows.filter((row) => isAfterCursor(row, parsedCursor)) : sortedRows;
	const hasMore = cursorFilteredRows.length > limit;
	const selectedRows = hasMore ? cursorFilteredRows.slice(0, limit) : cursorFilteredRows;

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

	const newCommentCountByPostId = await loadNewCommentCountByPostId({
		rows: selectedRows,
		readAtByPostId,
		userId: input.userId,
	});

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
