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

function buildDailyBuckets(records: Array<{ createdAt: Date }>) {
	return records.reduce<Record<string, number>>((acc, record) => {
		const dateKey = getDateKey(record.createdAt);
		acc[dateKey] = (acc[dateKey] ?? 0) + 1;
		return acc;
	}, {});
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
			inquiries,
			pendingUsers,
			pendingInquiries,
			userCountBeforeRange,
			postCountBeforeRange,
			commentCountBeforeRange,
			recentUsers,
			recentPosts,
			recentComments,
		] = await Promise.all([
			prisma.user.count({ where: { deletedAt: null } }),
			prisma.post.count({ where: { deletedAt: null } }),
			prisma.comment.count(),
			prisma.inquiry.count({ where: { archivedAt: null } }),
			prisma.user.count({ where: { deletedAt: null, isApproved: 0 } }),
			prisma.inquiry.count({ where: { status: "pending", archivedAt: null } }),
			prisma.user.count({
				where: { deletedAt: null, createdAt: { lt: rangeStart } },
			}),
			prisma.post.count({
				where: { deletedAt: null, createdAt: { lt: rangeStart } },
			}),
			prisma.comment.count({
				where: { createdAt: { lt: rangeStart } },
			}),
			prisma.user.findMany({
				where: { deletedAt: null, createdAt: { gte: rangeStart } },
				select: { createdAt: true },
			}),
			prisma.post.findMany({
				where: { deletedAt: null, createdAt: { gte: rangeStart } },
				select: { createdAt: true },
			}),
			prisma.comment.findMany({
				where: { createdAt: { gte: rangeStart } },
				select: { createdAt: true },
			}),
		]);

		const coreTrend = buildCoreTrend(
			dateKeys,
			userCountBeforeRange,
			postCountBeforeRange,
			commentCountBeforeRange,
			buildDailyBuckets(recentUsers),
			buildDailyBuckets(recentPosts),
			buildDailyBuckets(recentComments)
		);

		return NextResponse.json({
			stats: {
				users,
				posts,
				comments,
				inquiries,
				pendingUsers,
				pendingInquiries,
				coreTrend,
			},
		});
	} catch (error) {
		console.error("[API] GET /api/admin/stats error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
