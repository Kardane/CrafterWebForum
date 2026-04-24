import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const postFindFirstMock = vi.fn();
const commentFindManyMock = vi.fn();
const commentCountMock = vi.fn();
const commentFindFirstMock = vi.fn();
const commentCreateMock = vi.fn();
const postReadUpsertMock = vi.fn();
const postUpdateMock = vi.fn();
const userFindManyMock = vi.fn();
const notificationCreateManyMock = vi.fn();
const notificationFindManyMock = vi.fn();
const pushSubscriptionFindManyMock = vi.fn();
const postSubscriptionFindManyMock = vi.fn();
const notificationDeliveryCreateManyMock = vi.fn();
const commentSideEffectJobCreateMock = vi.fn();
const transactionMock = vi.fn();
const resolveActiveUserFromSessionMock = vi.fn();
const fetchCommentSubtreeRowsByRootIdsMock = vi.fn();
const broadcastRealtimeMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			findFirst: postFindFirstMock,
			update: postUpdateMock,
		},
		comment: {
			findMany: commentFindManyMock,
			count: commentCountMock,
			findFirst: commentFindFirstMock,
			create: commentCreateMock,
		},
		user: {
			findMany: userFindManyMock,
		},
		notification: {
			createMany: notificationCreateManyMock,
			findMany: notificationFindManyMock,
		},
		pushSubscription: {
			findMany: pushSubscriptionFindManyMock,
		},
		postSubscription: {
			findMany: postSubscriptionFindManyMock,
		},
		notificationDelivery: {
			createMany: notificationDeliveryCreateManyMock,
		},
		commentSideEffectJob: {
			create: commentSideEffectJobCreateMock,
		},
		postRead: {
			upsert: postReadUpsertMock,
		},
		$transaction: transactionMock,
	},
}));

vi.mock("@/lib/active-user", () => ({
	resolveActiveUserFromSession: resolveActiveUserFromSessionMock,
}));

vi.mock("@/lib/comment-subtree-query", () => ({
	fetchCommentSubtreeRowsByRootIds: fetchCommentSubtreeRowsByRootIdsMock,
}));

vi.mock("@/lib/realtime/server-broadcast", () => ({
	broadcastRealtime: broadcastRealtimeMock,
}));

function buildCommentRow(input: {
	id: number;
	postId: number;
	authorId: number;
	parentId: number | null;
	nickname: string;
	content?: string;
}) {
	return {
		id: input.id,
		postId: input.postId,
		authorId: input.authorId,
		content: input.content ?? "comment",
		isPinned: 0,
		parentId: input.parentId,
		createdAt: new Date("2026-02-27T00:00:00.000Z"),
		updatedAt: new Date("2026-02-27T00:00:00.000Z"),
		author: {
			id: input.authorId,
			nickname: input.nickname,
			minecraftUuid: null,
			role: "user",
		},
	};
}

describe("POST /api/posts/[id]/comments", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		postFindFirstMock.mockReset();
		commentFindManyMock.mockReset();
		commentCountMock.mockReset();
		commentFindFirstMock.mockReset();
		commentCreateMock.mockReset();
		postReadUpsertMock.mockReset();
		postUpdateMock.mockReset();
		userFindManyMock.mockReset();
		notificationCreateManyMock.mockReset();
		notificationFindManyMock.mockReset();
		pushSubscriptionFindManyMock.mockReset();
		postSubscriptionFindManyMock.mockReset();
		notificationDeliveryCreateManyMock.mockReset();
		commentSideEffectJobCreateMock.mockReset();
		transactionMock.mockReset();
		resolveActiveUserFromSessionMock.mockReset();
		fetchCommentSubtreeRowsByRootIdsMock.mockReset();
		broadcastRealtimeMock.mockReset();
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: true,
			context: { userId: 10, role: "user", nickname: "actor", isApproved: 1, isBanned: 0 },
		});

		transactionMock.mockImplementation(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[]));
		postUpdateMock.mockResolvedValue({ commentCount: 1 });
		commentCountMock.mockResolvedValue(1);
		notificationCreateManyMock.mockResolvedValue({ count: 0 });
		notificationFindManyMock.mockResolvedValue([]);
		pushSubscriptionFindManyMock.mockResolvedValue([]);
		postSubscriptionFindManyMock.mockResolvedValue([]);
		notificationDeliveryCreateManyMock.mockResolvedValue({ count: 0 });
		commentSideEffectJobCreateMock.mockResolvedValue({ id: 900, commentId: 101 });
	});

	it("returns paginated comment tree when cursor pagination is requested", async () => {
		authMock.mockResolvedValue({ user: { id: "10", isApproved: 1 } });
		postFindFirstMock.mockResolvedValue({ id: 12, authorId: 1, deletedAt: null });
		commentFindManyMock.mockResolvedValueOnce([
			buildCommentRow({ id: 30, postId: 12, authorId: 1, parentId: null, nickname: "root-a" }),
			buildCommentRow({ id: 20, postId: 12, authorId: 2, parentId: null, nickname: "root-b" }),
		]);
		fetchCommentSubtreeRowsByRootIdsMock.mockResolvedValue([
			buildCommentRow({ id: 30, postId: 12, authorId: 1, parentId: null, nickname: "root-a" }),
			buildCommentRow({ id: 31, postId: 12, authorId: 3, parentId: 30, nickname: "reply-a" }),
		]);

		const { GET } = await import("@/app/api/posts/[id]/comments/route");
		const req = new Request("http://localhost/api/posts/12/comments?limit=1");
		const res = await GET(req as never, { params: Promise.resolve({ id: "12" }) });
		const body = (await res.json()) as {
			comments: Array<{ id: number; replies: Array<{ id: number }> }>;
			page: { limit: number; nextCursor: number | null; hasMore: boolean };
		};

		expect(res.status).toBe(200);
		expect(body.page).toEqual({ limit: 1, nextCursor: 30, hasMore: true });
		expect(body.comments).toHaveLength(1);
		expect(body.comments[0]?.id).toBe(30);
		expect(body.comments[0]?.replies).toHaveLength(1);
		expect(commentFindManyMock).toHaveBeenCalledTimes(1);
		expect(fetchCommentSubtreeRowsByRootIdsMock).toHaveBeenCalledWith(12, [30]);
	});

	it("uses default root pagination when limit and cursor are omitted", async () => {
		authMock.mockResolvedValue({ user: { id: "10", isApproved: 1 } });
		postFindFirstMock.mockResolvedValue({ id: 12, authorId: 1, deletedAt: null });
		commentFindManyMock.mockResolvedValueOnce([
			buildCommentRow({ id: 30, postId: 12, authorId: 1, parentId: null, nickname: "root-a" }),
			buildCommentRow({ id: 20, postId: 12, authorId: 2, parentId: null, nickname: "root-b" }),
		]);
		fetchCommentSubtreeRowsByRootIdsMock.mockResolvedValue([
			buildCommentRow({ id: 30, postId: 12, authorId: 1, parentId: null, nickname: "root-a" }),
			buildCommentRow({ id: 20, postId: 12, authorId: 2, parentId: null, nickname: "root-b" }),
		]);

		const { GET } = await import("@/app/api/posts/[id]/comments/route");
		const req = new Request("http://localhost/api/posts/12/comments");
		const res = await GET(req as never, { params: Promise.resolve({ id: "12" }) });
		const body = (await res.json()) as {
			comments: Array<{ id: number }>;
			page: { limit: number; nextCursor: number | null; hasMore: boolean };
		};

		expect(res.status).toBe(200);
		expect(body.page).toEqual({ limit: 20, nextCursor: null, hasMore: false });
		expect(body.comments.map((comment) => comment.id)).toEqual([30, 20]);
		expect(commentFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					postId: 12,
					parentId: null,
				}),
				take: 21,
			})
		);
		expect(fetchCommentSubtreeRowsByRootIdsMock).toHaveBeenCalledWith(12, [30, 20]);
	});

	it("returns 400 when pagination cursor is invalid", async () => {
		authMock.mockResolvedValue({ user: { id: "10", isApproved: 1 } });
		postFindFirstMock.mockResolvedValue({ id: 12, authorId: 1, deletedAt: null });

		const { GET } = await import("@/app/api/posts/[id]/comments/route");
		const req = new Request("http://localhost/api/posts/12/comments?cursor=abc");
		const res = await GET(req as never, { params: Promise.resolve({ id: "12" }) });

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({ error: "Invalid cursor" });
	});

	it("returns 403 when user is pending approval", async () => {
		authMock.mockResolvedValue({ user: { id: "10", isApproved: 0 } });
		resolveActiveUserFromSessionMock.mockResolvedValue({ ok: false, status: 403, error: "pending_approval" });

		const { POST } = await import("@/app/api/posts/[id]/comments/route");
		const req = new Request("http://localhost/api/posts/12/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "hello" }),
		});

		const res = await POST(req as never, { params: Promise.resolve({ id: "12" }) });

		expect(res.status).toBe(403);
		await expect(res.json()).resolves.toEqual({ error: "pending_approval" });
		expect(postFindFirstMock).not.toHaveBeenCalled();
		expect(commentCreateMock).not.toHaveBeenCalled();
	});

	it("allows pending users to comment on sinmungo posts", async () => {
		authMock.mockResolvedValue({ user: { id: "10", isApproved: 0, nickname: "actor" } });
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: true,
			context: { userId: 10, role: "user", nickname: "actor", isApproved: 0, isBanned: 0 },
		});
		postFindFirstMock.mockResolvedValue({ id: 12, authorId: 1, deletedAt: null, tags: null, board: "sinmungo" });
		commentCreateMock.mockResolvedValue(
			buildCommentRow({ id: 150, postId: 12, authorId: 10, parentId: null, nickname: "actor", content: "hello" })
		);
		postUpdateMock.mockResolvedValue({ commentCount: 2 });

		const { POST } = await import("@/app/api/posts/[id]/comments/route");
		const req = new Request("http://localhost/api/posts/12/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "hello" }),
		});

		const res = await POST(req as never, { params: Promise.resolve({ id: "12" }) });
		expect(res.status).toBe(200);
		expect(commentCreateMock).toHaveBeenCalled();
	});

	it("queues comment side effect job instead of inline notifications", async () => {
		authMock.mockResolvedValue({ user: { id: "10", isApproved: 1, nickname: "actor" } });
		postFindFirstMock.mockResolvedValue({ id: 12, authorId: 1, deletedAt: null, tags: null });
		commentCreateMock.mockResolvedValue(
			buildCommentRow({ id: 101, postId: 12, authorId: 10, parentId: null, nickname: "actor", content: "@alice hi" })
		);
		postUpdateMock.mockResolvedValue({ commentCount: 5 });

		const { POST } = await import("@/app/api/posts/[id]/comments/route");
		const req = new Request("http://localhost/api/posts/12/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "@alice hi" }),
		});

		const res = await POST(req as never, { params: Promise.resolve({ id: "12" }) });

		expect(res.status).toBe(200);
		expect(transactionMock).toHaveBeenCalledTimes(1);
		expect(commentSideEffectJobCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					commentId: 101,
					postId: 12,
					actorUserId: 10,
					actorNickname: "actor",
					content: "@alice hi",
					status: "queued",
				}),
			})
		);
		expect(notificationCreateManyMock).not.toHaveBeenCalled();
		expect(notificationDeliveryCreateManyMock).not.toHaveBeenCalled();
	});

	it("falls back to inline notifications when CommentSideEffectJob table is missing", async () => {
		authMock.mockResolvedValue({ user: { id: "10", isApproved: 1, nickname: "actor" } });
		postFindFirstMock.mockResolvedValue({ id: 12, authorId: 1, deletedAt: null, tags: null });
		commentCreateMock.mockResolvedValue(
			buildCommentRow({ id: 102, postId: 12, authorId: 10, parentId: null, nickname: "actor", content: "@alice hello" })
		);
		postUpdateMock.mockResolvedValue({ commentCount: 6 });
		commentSideEffectJobCreateMock.mockRejectedValue(
			new Error("SQLITE_UNKNOWN: SQLite error: no such table: main.CommentSideEffectJob")
		);
		userFindManyMock.mockResolvedValue([{ id: 20, nickname: "alice" }]);
		postSubscriptionFindManyMock.mockResolvedValue([{ userId: 30, user: { nickname: "watcher" } }]);
		notificationCreateManyMock.mockResolvedValue({ count: 2 });
		notificationFindManyMock.mockResolvedValue([
			{ id: 501, userId: 20 },
			{ id: 601, userId: 30 },
		]);
		pushSubscriptionFindManyMock.mockResolvedValue([
			{ id: 33, userId: 20 },
			{ id: 41, userId: 30 },
		]);

		const { POST } = await import("@/app/api/posts/[id]/comments/route");
		const req = new Request("http://localhost/api/posts/12/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "@alice hello" }),
		});

		const res = await POST(req as never, { params: Promise.resolve({ id: "12" }) });

		expect(res.status).toBe(200);
		expect(notificationCreateManyMock).toHaveBeenCalled();
		expect(notificationDeliveryCreateManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({
						notificationId: 501,
						userId: 20,
						subscriptionId: 33,
						channel: "web_push",
					}),
					expect.objectContaining({
						notificationId: 601,
						userId: 30,
						subscriptionId: 41,
						channel: "web_push",
					}),
				]),
			})
		);
	});

	it("keeps comment creation working when PostSubscription table is missing", async () => {
		authMock.mockResolvedValue({ user: { id: "10", isApproved: 1, nickname: "actor" } });
		postFindFirstMock.mockResolvedValue({ id: 12, authorId: 1, deletedAt: null, tags: null });
		commentCreateMock.mockResolvedValue(
			buildCommentRow({ id: 103, postId: 12, authorId: 10, parentId: null, nickname: "actor", content: "hello" })
		);
		postUpdateMock.mockResolvedValue({ commentCount: 7 });
		commentSideEffectJobCreateMock.mockRejectedValue(
			new Error("SQLITE_UNKNOWN: SQLite error: no such table: main.CommentSideEffectJob")
		);
		postSubscriptionFindManyMock.mockRejectedValue(
			new Error("SQLITE_UNKNOWN: SQLite error: no such table: main.PostSubscription")
		);

		const { POST } = await import("@/app/api/posts/[id]/comments/route");
		const req = new Request("http://localhost/api/posts/12/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "hello" }),
		});

		const res = await POST(req as never, { params: Promise.resolve({ id: "12" }) });
		expect(res.status).toBe(200);
		expect(notificationCreateManyMock).not.toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.arrayContaining([
					expect.objectContaining({ type: "post_comment" }),
				]),
			})
		);
	});

	it("falls back when Post board column is missing during comment creation", async () => {
		authMock.mockResolvedValue({ user: { id: "10", isApproved: 0, nickname: "actor" } });
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: true,
			context: { userId: 10, role: "user", nickname: "actor", isApproved: 0, isBanned: 0 },
		});
		postFindFirstMock
			.mockRejectedValueOnce(new Error("SQLITE_UNKNOWN: SQLite error: no such column: main.Post.board"))
			.mockResolvedValueOnce({ id: 12, authorId: 1, deletedAt: null, tags: '["__sys:board:ombudsman"]' });
		commentCreateMock.mockResolvedValue(
			buildCommentRow({ id: 160, postId: 12, authorId: 10, parentId: null, nickname: "actor", content: "hello" })
		);
		postUpdateMock.mockResolvedValue({ commentCount: 2 });

		const { POST } = await import("@/app/api/posts/[id]/comments/route");
		const req = new Request("http://localhost/api/posts/12/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "hello" }),
		});

		const res = await POST(req as never, { params: Promise.resolve({ id: "12" }) });
		expect(res.status).toBe(200);
		expect(postFindFirstMock).toHaveBeenCalledTimes(2);
	});

	it("falls back when Post.commentCount column is missing during comment creation", async () => {
		authMock.mockResolvedValue({ user: { id: "10", isApproved: 1, nickname: "actor" } });
		postFindFirstMock.mockResolvedValue({ id: 12, authorId: 1, deletedAt: null, tags: null, board: "develope" });
		commentCreateMock
			.mockResolvedValueOnce(
				buildCommentRow({ id: 170, postId: 12, authorId: 10, parentId: null, nickname: "actor", content: "hello" })
			)
			.mockResolvedValueOnce(
				buildCommentRow({ id: 171, postId: 12, authorId: 10, parentId: null, nickname: "actor", content: "hello" })
			);
		postUpdateMock
			.mockRejectedValueOnce(new Error("SQLITE_UNKNOWN: SQLite error: no such column: main.Post.commentCount"))
			.mockResolvedValueOnce({});
		commentCountMock.mockResolvedValueOnce(4);

		const { POST } = await import("@/app/api/posts/[id]/comments/route");
		const req = new Request("http://localhost/api/posts/12/comments", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "hello" }),
		});

		const res = await POST(req as never, { params: Promise.resolve({ id: "12" }) });
		const body = (await res.json()) as { success: boolean };
		expect(res.status).toBe(200);
		expect(body.success).toBe(true);
		expect(commentCountMock).toHaveBeenCalledWith({ where: { postId: 12 } });
	});
});
