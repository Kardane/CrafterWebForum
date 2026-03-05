import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import {
	ADMIN_TREND_RANGE_DAYS,
	DEFAULT_ADMIN_TREND_RANGE,
	type AdminTrendRangeKey,
} from "@/constants/admin-trend";

function parseTrendRange(range: string | null): AdminTrendRangeKey {
	if (!range) {
		return DEFAULT_ADMIN_TREND_RANGE;
	}

	if (Object.prototype.hasOwnProperty.call(ADMIN_TREND_RANGE_DAYS, range)) {
		return range as AdminTrendRangeKey;
	}

	return DEFAULT_ADMIN_TREND_RANGE;
}

function getDateKey(date: Date) {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, "0");
	const day = String(date.getUTCDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function buildDateKeys(startDate: Date, days: number) {
	return Array.from({ length: days }, (_, index) => {
		const date = new Date(startDate);
		date.setUTCDate(startDate.getUTCDate() + index);
		return getDateKey(date);
	});
}

type DailyBucketRow = {
	dateKey: string | null;
	total: unknown;
};

function normalizeCountValue(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === "bigint") {
		return Number(value);
	}
	if (typeof value === "string") {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function buildDailyBucketsFromRows(rows: DailyBucketRow[]) {
	return rows.reduce<Record<string, number>>((acc, row) => {
		if (!row.dateKey) {
			return acc;
		}
		acc[row.dateKey] = normalizeCountValue(row.total);
		return acc;
	}, {});
}

function sumDailyBuckets(buckets: Record<string, number>) {
	return Object.values(buckets).reduce((sum, count) => sum + count, 0);
}

async function findUserDailyBuckets(rangeStart: Date) {
	const rows = await prisma.$queryRaw<DailyBucketRow[]>`
		SELECT strftime('%Y-%m-%d', "createdAt") as dateKey, COUNT(*) as total
		FROM "User"
		WHERE "deletedAt" IS NULL
			AND "createdAt" >= ${rangeStart}
		GROUP BY strftime('%Y-%m-%d', "createdAt")
	`;
	return buildDailyBucketsFromRows(rows);
}

async function findPostDailyBuckets(rangeStart: Date) {
	const rows = await prisma.$queryRaw<DailyBucketRow[]>`
		SELECT strftime('%Y-%m-%d', "createdAt") as dateKey, COUNT(*) as total
		FROM "Post"
		WHERE "deletedAt" IS NULL
			AND "createdAt" >= ${rangeStart}
		GROUP BY strftime('%Y-%m-%d', "createdAt")
	`;
	return buildDailyBucketsFromRows(rows);
}

async function findCommentDailyBuckets(rangeStart: Date) {
	const rows = await prisma.$queryRaw<DailyBucketRow[]>`
		SELECT strftime('%Y-%m-%d', "createdAt") as dateKey, COUNT(*) as total
		FROM "Comment"
		WHERE "createdAt" >= ${rangeStart}
		GROUP BY strftime('%Y-%m-%d', "createdAt")
	`;
	return buildDailyBucketsFromRows(rows);
}

function buildCoreTrend(
	dateKeys: string[],
	initialUsers: number,
	initialPosts: number,
	initialComments: number,
	userDailyBuckets: Record<string, number>,
	postDailyBuckets: Record<string, number>,
	commentDailyBuckets: Record<string, number>
) {
	let users = initialUsers;
	let posts = initialPosts;
	let comments = initialComments;

	return dateKeys.map((date) => {
		users += userDailyBuckets[date] ?? 0;
		posts += postDailyBuckets[date] ?? 0;
		comments += commentDailyBuckets[date] ?? 0;
		return {
			date,
			users,
			posts,
			comments,
		};
	});
}

export async function GET(request: Request) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const trendRange = parseTrendRange(new URL(request.url).searchParams.get("range"));
		const trendDays = ADMIN_TREND_RANGE_DAYS[trendRange];
		const now = new Date();
		const rangeStart = new Date(
			Date.UTC(
				now.getUTCFullYear(),
				now.getUTCMonth(),
				now.getUTCDate() - (trendDays - 1),
				0,
				0,
				0,
				0
			)
		);
		const dateKeys = buildDateKeys(rangeStart, trendDays);

		const [
			users,
			posts,
			comments,
			pendingUsers,
			userDailyBuckets,
			postDailyBuckets,
			commentDailyBuckets,
		] = await Promise.all([
			prisma.user.count({ where: { deletedAt: null } }),
			prisma.post.count({ where: { deletedAt: null } }),
			prisma.comment.count(),
			prisma.user.count({ where: { deletedAt: null, isApproved: 0 } }),
			findUserDailyBuckets(rangeStart),
			findPostDailyBuckets(rangeStart),
			findCommentDailyBuckets(rangeStart),
		]);

		const userCountBeforeRange = Math.max(users - sumDailyBuckets(userDailyBuckets), 0);
		const postCountBeforeRange = Math.max(posts - sumDailyBuckets(postDailyBuckets), 0);
		const commentCountBeforeRange = Math.max(comments - sumDailyBuckets(commentDailyBuckets), 0);

		const coreTrend = buildCoreTrend(
			dateKeys,
			userCountBeforeRange,
			postCountBeforeRange,
			commentCountBeforeRange,
			userDailyBuckets,
			postDailyBuckets,
			commentDailyBuckets
		);

		return NextResponse.json({
			stats: {
				users,
				posts,
				comments,
				pendingUsers,
				coreTrend,
			},
		});
	} catch (error) {
		console.error("[API] GET /api/admin/stats error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
