import { beforeEach, describe, expect, it, vi } from "vitest";

const postFindManyMock = vi.fn();
const postSubscriptionFindManyMock = vi.fn();
const postReadFindManyMock = vi.fn();
const commentCountMock = vi.fn();
const commentGroupByMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			findMany: postFindManyMock,
		},
		comment: {
			count: commentCountMock,
			groupBy: commentGroupByMock,
		},
		postSubscription: {
			findMany: postSubscriptionFindManyMock,
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
		postSubscriptionFindManyMock.mockReset();
		postReadFindManyMock.mockReset();
		commentCountMock.mockReset();
		commentGroupByMock.mockReset();
	});

	it("merges authored/subscribed posts and sorts by activity", async () => {
		const activityRows = [
			{
				id: 1,
				title: "alpha",
				updatedAt: new Date("2026-03-03T10:00:00.000Z"),
				commentCount: 5,
				author: { nickname: "author-a", minecraftUuid: "uuid-a" },
			},
			{
				id: 3,
				title: "gamma",
				updatedAt: new Date("2026-03-01T10:00:00.000Z"),
				commentCount: 1,
				author: { nickname: "author-c", minecraftUuid: null },
			},
		];
		postFindManyMock.mockImplementation(async (args: { select?: { id?: boolean; title?: boolean } }) => {
			if (args.select?.title) {
				return activityRows;
			}
			return [{ id: 1 }];
		});
		postSubscriptionFindManyMock.mockResolvedValue([{ postId: 3 }]);
		postReadFindManyMock.mockResolvedValue([{ postId: 1, updatedAt: new Date("2026-03-03T09:30:00.000Z") }]);
		commentGroupByMock.mockResolvedValue([
			{ postId: 1, _max: { id: 1001 } },
			{ postId: 3, _max: { id: 3001 } },
		]);
		commentCountMock.mockImplementation(async ({ where }: { where: { postId: number } }) => {
			if (where.postId === 1) return 2;
			return 0;
		});

		const { listSidebarTrackedPosts } = await import("@/lib/services/sidebar-tracked-posts-service");
		const result = await listSidebarTrackedPosts({ userId: 7, limit: 30 });

		expect(result.items.map((item) => item.postId)).toEqual([1, 3]);
		expect(result.items[0]).toMatchObject({
			postId: 1,
			author: { nickname: "author-a", minecraftUuid: "uuid-a" },
			sourceFlags: { authored: true, subscribed: false },
			isSubscribed: false,
			commentCount: 5,
			newCommentCount: 2,
			latestCommentId: 1001,
		});
		expect(result.items[1]).toMatchObject({
			postId: 3,
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
				updatedAt: new Date("2026-03-03T12:00:00.000Z"),
				commentCount: 4,
				author: { nickname: "u11", minecraftUuid: null },
			},
			{
				id: 10,
				title: "second",
				updatedAt: new Date("2026-03-02T12:00:00.000Z"),
				commentCount: 2,
				author: { nickname: "u10", minecraftUuid: null },
			},
			{
				id: 9,
				title: "third",
				updatedAt: new Date("2026-03-01T12:00:00.000Z"),
				commentCount: 0,
				author: { nickname: "u9", minecraftUuid: null },
			},
		];
		postFindManyMock.mockImplementation(async (args: { select?: { id?: boolean; title?: boolean } }) => {
			if (args.select?.title) {
				return activityRows;
			}
			return [];
		});
		postSubscriptionFindManyMock.mockResolvedValue([{ postId: 11 }, { postId: 10 }, { postId: 9 }]);
		postReadFindManyMock.mockResolvedValue([]);
		commentGroupByMock.mockResolvedValue([
			{ postId: 11, _max: { id: 111 } },
			{ postId: 10, _max: { id: 101 } },
			{ postId: 9, _max: { id: 91 } },
		]);
		commentCountMock.mockResolvedValue(0);

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

	it("falls back to authored posts when PostSubscription table is missing", async () => {
		const activityRows = [
			{
				id: 5,
				title: "authored-only",
				updatedAt: new Date("2026-03-03T12:00:00.000Z"),
				commentCount: 2,
				author: { nickname: "u5", minecraftUuid: null },
			},
		];
		postFindManyMock.mockImplementation(async (args: { select?: { id?: boolean; title?: boolean } }) => {
			if (args.select?.title) {
				return activityRows;
			}
			return [{ id: 5 }];
		});
		postSubscriptionFindManyMock.mockRejectedValue(
			new Error("SQLITE_UNKNOWN: SQLite error: no such table: main.PostSubscription")
		);
		postReadFindManyMock.mockResolvedValue([]);
		commentGroupByMock.mockResolvedValue([{ postId: 5, _max: { id: 55 } }]);
		commentCountMock.mockResolvedValue(0);

		const { listSidebarTrackedPosts } = await import("@/lib/services/sidebar-tracked-posts-service");
		const result = await listSidebarTrackedPosts({ userId: 7, limit: 30 });

		expect(result.items).toHaveLength(1);
		expect(result.items[0]).toMatchObject({
			postId: 5,
			sourceFlags: { authored: true, subscribed: false },
			isSubscribed: false,
		});
	});
});
