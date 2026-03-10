import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const postFindFirstMock = vi.fn();
const likeFindFirstMock = vi.fn();
const postSubscriptionFindUniqueMock = vi.fn();
const commentFindManyMock = vi.fn();
const commentCountMock = vi.fn();
const postReadFindUniqueMock = vi.fn();
const postReadUpsertMock = vi.fn();
const resolveActiveUserFromSessionMock = vi.fn();
const fetchCommentSubtreeRowsByRootIdsMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			findFirst: postFindFirstMock,
		},
		like: {
			findFirst: likeFindFirstMock,
		},
		postSubscription: {
			findUnique: postSubscriptionFindUniqueMock,
		},
		comment: {
			count: commentCountMock,
			findMany: commentFindManyMock,
		},
			postRead: {
				findUnique: postReadFindUniqueMock,
				upsert: postReadUpsertMock,
			},
		},
}));

vi.mock("@/lib/active-user", () => ({
	resolveActiveUserFromSession: resolveActiveUserFromSessionMock,
}));

vi.mock("@/lib/comment-subtree-query", () => ({
	fetchCommentSubtreeRowsByRootIds: fetchCommentSubtreeRowsByRootIdsMock,
}));

describe("GET /api/posts/[id]", () => {
	beforeEach(() => {
		authMock.mockReset();
		postFindFirstMock.mockReset();
		likeFindFirstMock.mockReset();
		postSubscriptionFindUniqueMock.mockReset();
		commentFindManyMock.mockReset();
		commentCountMock.mockReset();
		postReadFindUniqueMock.mockReset();
		postReadUpsertMock.mockReset();
		resolveActiveUserFromSessionMock.mockReset();
		fetchCommentSubtreeRowsByRootIdsMock.mockReset();
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: true,
			context: { userId: 1, role: "user", nickname: "writer", isApproved: 1, isBanned: 0 },
		});
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);
		resolveActiveUserFromSessionMock.mockResolvedValue({ ok: false, status: 401, error: "unauthorized" });

		const { GET } = await import("@/app/api/posts/[id]/route");
		const req = new Request("http://localhost/api/posts/1");
		const res = await GET(req as never, { params: Promise.resolve({ id: "1" }) });

		expect(res.status).toBe(401);
	}, 15_000);

	it("returns 403 when user is pending approval", async () => {
		authMock.mockResolvedValue({ user: { id: "1", isApproved: 0 } });
		resolveActiveUserFromSessionMock.mockResolvedValue({ ok: false, status: 403, error: "pending_approval" });

		const { GET } = await import("@/app/api/posts/[id]/route");
		const req = new Request("http://localhost/api/posts/1");
		const res = await GET(req as never, { params: Promise.resolve({ id: "1" }) });

		expect(res.status).toBe(403);
		await expect(res.json()).resolves.toEqual({ error: "pending_approval" });
	});

	it("returns nested comment tree with author object", async () => {
		authMock.mockResolvedValue({ user: { id: "1" } });
		postFindFirstMock.mockResolvedValue({
			id: 10,
			title: "title",
			content: "content",
			tags: "[]",
			board: "sinmungo",
			serverAddress: "mc.sin.kr",
			commentCount: 2,
			likes: 2,
			views: 7,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T01:00:00.000Z"),
			authorId: 1,
			author: {
				id: 1,
				nickname: "writer",
				minecraftUuid: "uuid-1",
			},
		});
		likeFindFirstMock.mockResolvedValue(null);
		postSubscriptionFindUniqueMock.mockResolvedValue(null);
		commentCountMock.mockResolvedValue(2);
		commentFindManyMock.mockResolvedValueOnce([
			{
				id: 100,
				content: "parent",
				createdAt: new Date("2026-01-01T02:00:00.000Z"),
				updatedAt: new Date("2026-01-01T02:00:00.000Z"),
				isPinned: 0,
				parentId: null,
				author: {
					id: 2,
					nickname: "alice",
					minecraftUuid: null,
					role: "user",
				},
			},
		]);
		fetchCommentSubtreeRowsByRootIdsMock.mockResolvedValue([
			{
				id: 100,
				postId: 10,
				authorId: 2,
				content: "parent",
				createdAt: new Date("2026-01-01T02:00:00.000Z"),
				updatedAt: new Date("2026-01-01T02:00:00.000Z"),
				isPinned: 0,
				parentId: null,
				author: {
					id: 2,
					nickname: "alice",
					minecraftUuid: null,
					role: "user",
				},
			},
			{
				id: 101,
				postId: 10,
				authorId: 1,
				content: "child",
				createdAt: new Date("2026-01-01T02:01:00.000Z"),
				updatedAt: new Date("2026-01-01T02:01:00.000Z"),
				isPinned: 0,
				parentId: 100,
				author: {
					id: 1,
					nickname: "writer",
					minecraftUuid: "uuid-1",
					role: "user",
				},
			},
		]);
			postReadFindUniqueMock.mockResolvedValue({
				lastReadCommentCount: 1,
			});
			postReadUpsertMock.mockResolvedValue({});

		const { GET } = await import("@/app/api/posts/[id]/route");
		const req = new Request("http://localhost/api/posts/10");
		const res = await GET(req as never, { params: Promise.resolve({ id: "10" }) });
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(likeFindFirstMock).toHaveBeenCalledWith({
			where: { postId: 10, userId: 1 },
			select: { id: true },
		});
		expect(postSubscriptionFindUniqueMock).toHaveBeenCalledWith({
			where: {
				userId_postId: {
					userId: 1,
					postId: 10,
				},
			},
			select: {
				postId: true,
			},
		});
		expect(body.comments).toHaveLength(1);
			expect(body.comments[0].author).toEqual({
				id: 2,
				nickname: "alice",
				minecraftUuid: null,
				role: "user",
			});
			expect(body.comments[0].isPostAuthor).toBe(false);
			expect(body.comments[0].replies).toHaveLength(1);
			expect(body.comments[0].replies[0].isPostAuthor).toBe(true);
			expect(body.readMarker).toEqual({
				lastReadCommentCount: 1,
				totalCommentCount: 2,
			});

			const serverTiming = res.headers.get("Server-Timing");
			expect(serverTiming).toContain("query_post;dur=");
			expect(serverTiming).toContain("query_like;dur=");
			expect(serverTiming).toContain("query_comments;dur=");
			expect(serverTiming).toContain("query_read;dur=");
			expect(serverTiming).toContain("write_read;dur=");
			expect(serverTiming).toContain("serialize;dur=");
		});

	it("skips read upsert when read count is already synced", async () => {
		authMock.mockResolvedValue({ user: { id: "1" } });
		postFindFirstMock.mockResolvedValue({
			id: 10,
			title: "title",
			content: "content",
			tags: "[]",
			board: "develope",
			serverAddress: null,
			commentCount: 1,
			likes: 2,
			views: 7,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T01:00:00.000Z"),
			authorId: 1,
			author: {
				id: 1,
				nickname: "writer",
				minecraftUuid: "uuid-1",
			},
		});
		likeFindFirstMock.mockResolvedValue(null);
		postSubscriptionFindUniqueMock.mockResolvedValue(null);
		commentCountMock.mockResolvedValue(1);
		commentFindManyMock.mockResolvedValueOnce([
			{
				id: 100,
				content: "parent",
				createdAt: new Date("2026-01-01T02:00:00.000Z"),
				updatedAt: new Date("2026-01-01T02:00:00.000Z"),
				isPinned: 0,
				parentId: null,
				author: {
					id: 2,
					nickname: "alice",
					minecraftUuid: null,
					role: "user",
				},
			},
		]);
		fetchCommentSubtreeRowsByRootIdsMock.mockResolvedValue([
			{
				id: 100,
				postId: 10,
				authorId: 2,
				content: "parent",
				createdAt: new Date("2026-01-01T02:00:00.000Z"),
				updatedAt: new Date("2026-01-01T02:00:00.000Z"),
				isPinned: 0,
				parentId: null,
				author: {
					id: 2,
					nickname: "alice",
					minecraftUuid: null,
					role: "user",
				},
			},
		]);
		postReadFindUniqueMock.mockResolvedValue({
			lastReadCommentCount: 1,
		});

		const { GET } = await import("@/app/api/posts/[id]/route");
		const req = new Request("http://localhost/api/posts/10");
		const res = await GET(req as never, { params: Promise.resolve({ id: "10" }) });

		expect(res.status).toBe(200);
		expect(postReadUpsertMock).not.toHaveBeenCalled();
	});

	it("falls back when PostSubscription table is missing", async () => {
		authMock.mockResolvedValue({ user: { id: "1" } });
		postFindFirstMock.mockResolvedValue({
			id: 10,
			title: "title",
			content: "content",
			tags: "[]",
			board: "develope",
			serverAddress: null,
			commentCount: 0,
			likes: 2,
			views: 7,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T01:00:00.000Z"),
			authorId: 1,
			author: {
				id: 1,
				nickname: "writer",
				minecraftUuid: "uuid-1",
			},
		});
		likeFindFirstMock.mockResolvedValue(null);
		postSubscriptionFindUniqueMock.mockRejectedValue(
			new Error("SQLITE_UNKNOWN: SQLite error: no such table: main.PostSubscription")
		);
		commentCountMock.mockResolvedValue(0);
		commentFindManyMock.mockResolvedValueOnce([]);
		fetchCommentSubtreeRowsByRootIdsMock.mockResolvedValue([]);
		postReadFindUniqueMock.mockResolvedValue(null);

		const { GET } = await import("@/app/api/posts/[id]/route");
		const req = new Request("http://localhost/api/posts/10");
		const res = await GET(req as never, { params: Promise.resolve({ id: "10" }) });
		expect(res.status).toBe(200);
		const body = (await res.json()) as { post: { user_subscribed: boolean } };
		expect(body.post.user_subscribed).toBe(false);
	});

	it("falls back when Post.commentCount column is missing", async () => {
		authMock.mockResolvedValue({ user: { id: "1" } });
		postFindFirstMock
			.mockRejectedValueOnce(new Error("SQLITE_UNKNOWN: SQLite error: table Post has no column named commentCount"))
			.mockResolvedValueOnce({
				id: 55,
				title: "legacy detail",
				content: "content",
				tags: '["__sys:server:mc.legacy.kr","__sys:board:ombudsman"]',
				likes: 0,
				views: 0,
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				updatedAt: new Date("2026-01-01T01:00:00.000Z"),
				authorId: 1,
				author: {
					id: 1,
					nickname: "writer",
					minecraftUuid: "uuid-1",
				},
			});
		likeFindFirstMock.mockResolvedValue(null);
		postSubscriptionFindUniqueMock.mockResolvedValue(null);
		commentCountMock.mockResolvedValue(4);
		commentFindManyMock.mockResolvedValueOnce([]);
		fetchCommentSubtreeRowsByRootIdsMock.mockResolvedValue([]);
		postReadFindUniqueMock.mockResolvedValue(null);
		postReadUpsertMock.mockResolvedValue({});

		const { GET } = await import("@/app/api/posts/[id]/route");
		const req = new Request("http://localhost/api/posts/55");
		const res = await GET(req as never, { params: Promise.resolve({ id: "55" }) });
		const body = (await res.json()) as { post: { board: string; serverAddress: string | null }; readMarker: { totalCommentCount: number } };

		expect(res.status).toBe(200);
		expect(body.post).toMatchObject({
			board: "sinmungo",
			serverAddress: "mc.legacy.kr",
		});
		expect(body.readMarker.totalCommentCount).toBe(4);
	});

	it("returns board and serverAddress metadata in detail response", async () => {
		authMock.mockResolvedValue({ user: { id: "1" } });
		postFindFirstMock.mockResolvedValue({
			id: 55,
			title: "sinmungo title",
			content: "content",
			tags: "[]",
			board: "sinmungo",
			serverAddress: "mc.sinmungo.kr",
			commentCount: 0,
			likes: 0,
			views: 0,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T01:00:00.000Z"),
			authorId: 1,
			author: {
				id: 1,
				nickname: "writer",
				minecraftUuid: "uuid-1",
			},
		});
		likeFindFirstMock.mockResolvedValue(null);
		postSubscriptionFindUniqueMock.mockResolvedValue(null);
		commentCountMock.mockResolvedValue(0);
		commentFindManyMock.mockResolvedValueOnce([]);
		fetchCommentSubtreeRowsByRootIdsMock.mockResolvedValue([]);
		postReadFindUniqueMock.mockResolvedValue(null);

		const { GET } = await import("@/app/api/posts/[id]/route");
		const req = new Request("http://localhost/api/posts/55");
		const res = await GET(req as never, { params: Promise.resolve({ id: "55" }) });
		const body = (await res.json()) as { post: { board: string; serverAddress: string | null } };

		expect(res.status).toBe(200);
		expect(body.post).toMatchObject({
			board: "sinmungo",
			serverAddress: "mc.sinmungo.kr",
		});
	});
	});
