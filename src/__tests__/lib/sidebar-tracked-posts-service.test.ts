import { beforeEach, describe, expect, it, vi } from "vitest";

const postFindManyMock = vi.fn();
const postReadFindManyMock = vi.fn();
const commentGroupByMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			findMany: postFindManyMock,
		},
		comment: {
			groupBy: commentGroupByMock,
		},
		postRead: {
			findMany: postReadFindManyMock,
		},
	},
}));

describe("listSidebarTrackedPosts", () => {
	beforeEach(() => {
		vi.resetModules();
		postFindManyMock.mockReset();
		postReadFindManyMock.mockReset();
		commentGroupByMock.mockReset();
	});

	it("returns subscribed posts only and sorts by activity", async () => {
		const activityRows = [
			{
				id: 1,
				title: "alpha",
				board: "develope",
				serverAddress: null,
				updatedAt: new Date("2026-03-03T10:00:00.000Z"),
				commentCount: 5,
				authorId: 7,
				author: { nickname: "author-a", minecraftUuid: "uuid-a" },
			},
			{
				id: 3,
				title: "gamma",
				board: "sinmungo",
				serverAddress: "mc.gamma.kr",
				updatedAt: new Date("2026-03-01T10:00:00.000Z"),
				commentCount: 1,
				authorId: 11,
				author: { nickname: "author-c", minecraftUuid: null },
			},
		];
		postFindManyMock.mockResolvedValue(activityRows);
		postReadFindManyMock.mockResolvedValue([{ postId: 1, updatedAt: new Date("2026-03-03T09:30:00.000Z") }]);
		commentGroupByMock
			.mockResolvedValueOnce([
				{ postId: 1, _max: { id: 1001 } },
				{ postId: 3, _max: { id: 3001 } },
			])
			.mockResolvedValueOnce([
				{ postId: 1, _count: { _all: 2 } },
			]);

		const { listSidebarTrackedPosts } = await import("@/lib/services/sidebar-tracked-posts-service");
		const result = await listSidebarTrackedPosts({ userId: 7, limit: 30 });

		expect(postFindManyMock).toHaveBeenCalledWith({
			where: {
				deletedAt: null,
				subscriptions: {
					some: {
						userId: 7,
					},
				},
			},
			orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
			take: 31,
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

		expect(result.items.map((item) => item.postId)).toEqual([1, 3]);
		expect(result.items[0]).toMatchObject({
			postId: 1,
			board: "develope",
			serverAddress: null,
			author: { nickname: "author-a", minecraftUuid: "uuid-a" },
			sourceFlags: { authored: true, subscribed: true },
			isSubscribed: true,
			commentCount: 5,
			newCommentCount: 2,
			latestCommentId: 1001,
		});
		expect(result.items[1]).toMatchObject({
			postId: 3,
			board: "sinmungo",
			serverAddress: "mc.gamma.kr",
			author: { nickname: "author-c", minecraftUuid: null },
			sourceFlags: { authored: false, subscribed: true },
			isSubscribed: true,
			commentCount: 1,
			newCommentCount: 0,
			latestCommentId: 3001,
		});
		expect(result.page.hasMore).toBe(false);
	});

	it("supports cursor pagination with stable ordering", async () => {
		const activityRows = [
			{
				id: 11,
				title: "first",
				board: "develope",
				serverAddress: null,
				updatedAt: new Date("2026-03-03T12:00:00.000Z"),
				commentCount: 4,
				authorId: 5,
				author: { nickname: "u11", minecraftUuid: null },
			},
			{
				id: 10,
				title: "second",
				board: "develope",
				serverAddress: null,
				updatedAt: new Date("2026-03-02T12:00:00.000Z"),
				commentCount: 2,
				authorId: 7,
				author: { nickname: "u10", minecraftUuid: null },
			},
			{
				id: 9,
				title: "third",
				board: "sinmungo",
				serverAddress: "mc.third.kr",
				updatedAt: new Date("2026-03-01T12:00:00.000Z"),
				commentCount: 0,
				authorId: 8,
				author: { nickname: "u9", minecraftUuid: null },
			},
		];
		postFindManyMock.mockResolvedValue(activityRows);
		postReadFindManyMock.mockResolvedValue([]);
		commentGroupByMock
			.mockResolvedValueOnce([
				{ postId: 11, _max: { id: 111 } },
			])
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{ postId: 10, _max: { id: 101 } },
			])
			.mockResolvedValueOnce([]);

		const { listSidebarTrackedPosts } = await import("@/lib/services/sidebar-tracked-posts-service");
		const firstPage = await listSidebarTrackedPosts({ userId: 5, limit: 1 });
		expect(firstPage.items.map((item) => item.postId)).toEqual([11]);
		expect(firstPage.page.hasMore).toBe(true);
		expect(typeof firstPage.page.nextCursor).toBe("string");

		const secondPage = await listSidebarTrackedPosts({
			userId: 5,
			limit: 1,
			cursor: firstPage.page.nextCursor,
		});
		expect(secondPage.items.map((item) => item.postId)).toEqual([10]);
		expect(secondPage.page.hasMore).toBe(true);
	});

	it("returns empty list when PostSubscription table is missing", async () => {
		postFindManyMock.mockRejectedValue(
			new Error("SQLITE_UNKNOWN: SQLite error: no such table: main.PostSubscription")
		);

		const { listSidebarTrackedPosts } = await import("@/lib/services/sidebar-tracked-posts-service");
		const result = await listSidebarTrackedPosts({ userId: 7, limit: 30 });

		expect(result.items).toHaveLength(0);
		expect(result.page).toEqual({
			limit: 30,
			nextCursor: null,
			hasMore: false,
		});
		expect(postReadFindManyMock).not.toHaveBeenCalled();
		expect(commentGroupByMock).not.toHaveBeenCalled();
	});
});
