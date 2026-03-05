import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const postFindManyMock = vi.fn();
const postCountMock = vi.fn();
const transactionMock = vi.fn();
const likeFindManyMock = vi.fn();
const postSubscriptionFindManyMock = vi.fn();
const postReadFindManyMock = vi.fn();
const commentGroupByMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		$transaction: transactionMock,
		post: {
			findMany: postFindManyMock,
			count: postCountMock,
		},
		like: {
			findMany: likeFindManyMock,
		},
		postSubscription: {
			findMany: postSubscriptionFindManyMock,
		},
		postRead: {
			findMany: postReadFindManyMock,
		},
		comment: {
			groupBy: commentGroupByMock,
		},
	},
}));

describe("GET /api/posts", () => {
	beforeEach(() => {
		authMock.mockReset();
		postFindManyMock.mockReset();
		postCountMock.mockReset();
		transactionMock.mockReset();
		likeFindManyMock.mockReset();
		postSubscriptionFindManyMock.mockReset();
		postReadFindManyMock.mockReset();
		commentGroupByMock.mockReset();
		commentGroupByMock.mockResolvedValue([]);
		transactionMock.mockImplementation(async (operations: Promise<unknown>[]) =>
			Promise.all(operations)
		);
	});

	it("returns unreadCount and userLiked for authenticated user", async () => {
		authMock.mockResolvedValue({ user: { id: "7" } });
		postFindManyMock.mockResolvedValue([
			{
				id: 11,
				title: "alpha",
				content: "hello",
				tags: '["질문"]',
				likes: 4,
				views: 10,
				createdAt: new Date("2026-02-11T00:00:00Z"),
				updatedAt: new Date("2026-02-11T01:00:00Z"),
				author: { nickname: "tester", minecraftUuid: null },
				commentCount: 5,
			},
			{
				id: 12,
				title: "beta",
				content: "world",
				tags: null,
				likes: 1,
				views: 3,
				createdAt: new Date("2026-02-10T00:00:00Z"),
				updatedAt: new Date("2026-02-10T01:00:00Z"),
				author: { nickname: "tester2", minecraftUuid: "uuid-2" },
				commentCount: 1,
			},
		]);
		postCountMock.mockResolvedValue(2);
		likeFindManyMock.mockResolvedValue([{ postId: 11 }]);
		postSubscriptionFindManyMock.mockResolvedValue([{ postId: 12 }]);
		postReadFindManyMock.mockResolvedValue([
			{ postId: 11, lastReadCommentCount: 2 },
			{ postId: 12, lastReadCommentCount: 3 },
		]);

		const { GET } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts?page=1&limit=12&sort=activity");

		const res = await GET(req as never);
		expect(res.status).toBe(200);
		const payload = (await res.json()) as {
			posts: Array<{
				id: number;
				unreadCount: number;
				userLiked: boolean;
				userSubscribed: boolean;
				tags: string[];
				preview: string;
				thumbnailUrl: string | null;
			}>;
			metadata: { total: number; page: number; limit: number; totalPages: number };
		};

		expect(payload.posts).toHaveLength(2);
		expect(payload.posts[0]).toMatchObject({
			id: 11,
			unreadCount: 3,
			userLiked: true,
			userSubscribed: false,
			tags: ["질문"],
			preview: "hello",
			thumbnailUrl: null,
		});
		expect(payload.posts[1]).toMatchObject({
			id: 12,
			unreadCount: 0,
			userLiked: false,
			userSubscribed: true,
			tags: [],
			preview: "world",
			thumbnailUrl: null,
		});
		expect(payload.metadata).toMatchObject({
			total: 2,
			page: 1,
			limit: 12,
			totalPages: 1,
		});

		const serverTiming = res.headers.get("Server-Timing");
		expect(serverTiming).toContain("query_main;dur=");
		expect(serverTiming).toContain("query_aux;dur=");
		expect(serverTiming).toContain("serialize;dur=");
		expect(serverTiming).toContain("total;dur=");
	}, 15_000);

	it("falls back when PostSubscription table is missing", async () => {
		authMock.mockResolvedValue({ user: { id: "7" } });
		postFindManyMock.mockResolvedValue([
			{
				id: 31,
				title: "gamma",
				content: "hello",
				tags: "[]",
				likes: 0,
				views: 0,
				createdAt: new Date("2026-02-11T00:00:00Z"),
				updatedAt: new Date("2026-02-11T01:00:00Z"),
				author: { nickname: "tester", minecraftUuid: null },
				commentCount: 0,
			},
		]);
		postCountMock.mockResolvedValue(1);
		likeFindManyMock.mockResolvedValue([]);
		postReadFindManyMock.mockResolvedValue([]);
		postSubscriptionFindManyMock.mockRejectedValue(
			new Error("SQLITE_UNKNOWN: SQLite error: no such table: main.PostSubscription")
		);

		const { GET } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts?page=1&limit=12");

		const res = await GET(req as never);
		expect(res.status).toBe(200);
		const payload = (await res.json()) as {
			posts: Array<{ userSubscribed: boolean }>;
		};
		expect(payload.posts).toHaveLength(1);
		expect(payload.posts[0]?.userSubscribed).toBe(false);
	});

	it("returns unreadCount based on total comments when unauthenticated", async () => {
		authMock.mockResolvedValue(null);
		postFindManyMock.mockResolvedValue([
			{
				id: 21,
				title: "guest",
				content: "guest content",
				tags: "[]",
				likes: 0,
				views: 0,
				createdAt: new Date("2026-02-09T00:00:00Z"),
				updatedAt: new Date("2026-02-09T00:00:00Z"),
				author: { nickname: "guest", minecraftUuid: null },
				commentCount: 4,
			},
		]);
		postCountMock.mockResolvedValue(1);

		const { GET } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts");

		const res = await GET(req as never);
		expect(res.status).toBe(200);
		const payload = (await res.json()) as {
			posts: Array<{ unreadCount: number; userLiked: boolean; userSubscribed: boolean; preview: string; thumbnailUrl: string | null }>;
		};

		expect(payload.posts[0]).toMatchObject({
			unreadCount: 4,
			userLiked: false,
			userSubscribed: false,
			preview: "guest content",
			thumbnailUrl: null,
		});
		expect(likeFindManyMock).not.toHaveBeenCalled();
		expect(postSubscriptionFindManyMock).not.toHaveBeenCalled();
		expect(postFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				orderBy: { updatedAt: "desc" },
			})
		);
	});

	it("search query includes comment content condition when searchInComments=1", async () => {
		authMock.mockResolvedValue(null);
		postFindManyMock.mockResolvedValue([]);
		postCountMock.mockResolvedValue(0);

		const { GET } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts?search=레드스톤&searchInComments=1");

		const res = await GET(req as never);
		expect(res.status).toBe(200);
		expect(postFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					AND: expect.arrayContaining([
						expect.objectContaining({
							OR: expect.arrayContaining([
								{ title: { contains: "레드스톤" } },
								{ content: { contains: "레드스톤" } },
								{ comments: { some: { content: { contains: "레드스톤" } } } },
							]),
						}),
					]),
				}),
			})
		);
	});

});
