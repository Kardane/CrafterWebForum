import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const commentFindUniqueMock = vi.fn();
const commentUpdateMock = vi.fn();
const commentDeleteManyMock = vi.fn();
const postUpdateMock = vi.fn();
const postFindUniqueMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		comment: {
			findUnique: commentFindUniqueMock,
			update: commentUpdateMock,
			deleteMany: commentDeleteManyMock,
		},
		post: {
			findUnique: postFindUniqueMock,
			update: postUpdateMock,
		},
	},
}));

describe("PATCH /api/comments/[id]", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		commentFindUniqueMock.mockReset();
		commentUpdateMock.mockReset();
		commentDeleteManyMock.mockReset();
		postUpdateMock.mockReset();
		postFindUniqueMock.mockReset();
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);
		const { PATCH } = await import("@/app/api/comments/[id]/route");
		const req = new Request("http://localhost/api/comments/1", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "hello" }),
		});
		const res = await PATCH(req as never, { params: Promise.resolve({ id: "1" }) });
		expect(res.status).toBe(401);
	});

	it("normalizes string session id and updates own comment", async () => {
		authMock.mockResolvedValue({ user: { id: "5", role: "user" } });
		commentFindUniqueMock.mockResolvedValue({ id: 11, authorId: 5 });
		commentUpdateMock.mockResolvedValue({
			id: 11,
			content: "updated",
			createdAt: new Date("2026-02-08T00:00:00.000Z"),
			updatedAt: new Date("2026-02-08T00:01:00.000Z"),
			isPinned: false,
			parentId: null,
			author: {
				id: 5,
				nickname: "writer",
				minecraftUuid: null,
				role: "user",
			},
			post: {
				authorId: 5,
			},
		});
		postFindUniqueMock.mockResolvedValue({ authorId: 5, tags: null });
		postUpdateMock.mockResolvedValue({ id: 3 });

		const { PATCH } = await import("@/app/api/comments/[id]/route");
		const req = new Request("http://localhost/api/comments/11", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "updated" }),
		});
		const res = await PATCH(req as never, { params: Promise.resolve({ id: "11" }) });
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(commentUpdateMock).toHaveBeenCalledTimes(1);
		expect(body.comment.isPostAuthor).toBe(true);
	});

	it("allows admin to update another user's comment", async () => {
		authMock.mockResolvedValue({ user: { id: "1", role: "admin" } });
		commentFindUniqueMock.mockResolvedValue({ id: 11, authorId: 5, postId: 3 });
		commentUpdateMock.mockResolvedValue({
			id: 11,
			content: "updated by admin",
			createdAt: new Date("2026-02-08T00:00:00.000Z"),
			updatedAt: new Date("2026-02-08T00:01:00.000Z"),
			isPinned: false,
			parentId: null,
			author: {
				id: 5,
				nickname: "writer",
				minecraftUuid: null,
				role: "user",
			},
			post: {
				authorId: 9,
				tags: null,
			},
		});
		postFindUniqueMock.mockResolvedValue({ authorId: 9, tags: null });
		postUpdateMock.mockResolvedValue({ id: 3 });

		const { PATCH } = await import("@/app/api/comments/[id]/route");
		const req = new Request("http://localhost/api/comments/11", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "updated by admin" }),
		});
		const res = await PATCH(req as never, { params: Promise.resolve({ id: "11" }) });

		expect(res.status).toBe(200);
		expect(commentUpdateMock).toHaveBeenCalledTimes(1);
	});

	it("keeps comment update working when Post.tags column is missing", async () => {
		authMock.mockResolvedValue({ user: { id: "5", role: "user" } });
		commentFindUniqueMock.mockResolvedValue({ id: 11, authorId: 5, postId: 3 });
		commentUpdateMock.mockResolvedValue({
			id: 11,
			content: "updated",
			createdAt: new Date("2026-02-08T00:00:00.000Z"),
			updatedAt: new Date("2026-02-08T00:01:00.000Z"),
			isPinned: false,
			parentId: null,
			author: {
				id: 5,
				nickname: "writer",
				minecraftUuid: null,
				role: "user",
			},
		});
		postUpdateMock.mockResolvedValue({ id: 3 });
		postFindUniqueMock
			.mockRejectedValueOnce(new Error("SQLITE_UNKNOWN: SQLite error: no such column: Post.tags"))
			.mockResolvedValueOnce({ authorId: 5 });

		const { PATCH } = await import("@/app/api/comments/[id]/route");
		const req = new Request("http://localhost/api/comments/11", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content: "updated" }),
		});
		const res = await PATCH(req as never, { params: Promise.resolve({ id: "11" }) });
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(postFindUniqueMock).toHaveBeenCalledTimes(2);
		expect(body.comment.isPostAuthor).toBe(true);
	});
});

describe("POST /api/comments/[id]/pin", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		commentFindUniqueMock.mockReset();
		commentUpdateMock.mockReset();
		commentDeleteManyMock.mockReset();
		postUpdateMock.mockReset();
		postFindUniqueMock.mockReset();
	});

	it("returns 403 when caller is not admin", async () => {
		authMock.mockResolvedValue({ user: { id: "7", role: "user", nickname: "tester" } });
		const { POST } = await import("@/app/api/comments/[id]/pin/route");
		const req = new Request("http://localhost/api/comments/1/pin", { method: "POST" });
		const res = await POST(req as never, { params: Promise.resolve({ id: "1" }) });
		expect(res.status).toBe(403);
	});

	it("toggles pin state for admin", async () => {
		authMock.mockResolvedValue({ user: { id: "1", role: "admin", nickname: "admin" } });
		commentFindUniqueMock.mockResolvedValue({ id: 10, isPinned: 0, postId: 3 });
		commentUpdateMock.mockResolvedValue({ id: 10, isPinned: 1 });

		const { POST } = await import("@/app/api/comments/[id]/pin/route");
		const req = new Request("http://localhost/api/comments/10/pin", { method: "POST" });
		const res = await POST(req as never, { params: Promise.resolve({ id: "10" }) });
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(commentUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 10 },
				data: { isPinned: 1 },
			})
		);
		expect(body.comment.isPinned).toBe(true);
	});
});

describe("DELETE /api/comments/[id]", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		commentFindUniqueMock.mockReset();
		commentDeleteManyMock.mockReset();
		postUpdateMock.mockReset();
		postFindUniqueMock.mockReset();
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);
		const { DELETE } = await import("@/app/api/comments/[id]/route");
		const req = new Request("http://localhost/api/comments/1", { method: "DELETE" });
		const res = await DELETE(req as never, { params: Promise.resolve({ id: "1" }) });
		expect(res.status).toBe(401);
	});

	it("returns 403 for non-author non-admin user", async () => {
		authMock.mockResolvedValue({ user: { id: "5", role: "user" } });
		commentFindUniqueMock.mockResolvedValue({ id: 1, authorId: 9, postId: 3 });

		const { DELETE } = await import("@/app/api/comments/[id]/route");
		const req = new Request("http://localhost/api/comments/1", { method: "DELETE" });
		const res = await DELETE(req as never, { params: Promise.resolve({ id: "1" }) });

		expect(res.status).toBe(403);
		expect(commentDeleteManyMock).not.toHaveBeenCalled();
	});

	it("allows comment author to delete", async () => {
		authMock.mockResolvedValue({ user: { id: "5", role: "user" } });
		commentFindUniqueMock.mockResolvedValue({ id: 1, authorId: 5, postId: 3 });
		commentDeleteManyMock.mockResolvedValue({ count: 1 });
		postFindUniqueMock.mockResolvedValue({ tags: null, commentCount: 4 });
		postUpdateMock.mockResolvedValue({ id: 3 });

		const { DELETE } = await import("@/app/api/comments/[id]/route");
		const req = new Request("http://localhost/api/comments/1", { method: "DELETE" });
		const res = await DELETE(req as never, { params: Promise.resolve({ id: "1" }) });

		expect(res.status).toBe(200);
		expect(commentDeleteManyMock).toHaveBeenCalledTimes(1);
	});

	it("allows admin to delete", async () => {
		authMock.mockResolvedValue({ user: { id: "2", role: "admin" } });
		commentFindUniqueMock.mockResolvedValue({ id: 1, authorId: 9, postId: 3 });
		commentDeleteManyMock.mockResolvedValue({ count: 1 });
		postFindUniqueMock.mockResolvedValue({ tags: null, commentCount: 4 });
		postUpdateMock.mockResolvedValue({ id: 3 });

		const { DELETE } = await import("@/app/api/comments/[id]/route");
		const req = new Request("http://localhost/api/comments/1", { method: "DELETE" });
		const res = await DELETE(req as never, { params: Promise.resolve({ id: "1" }) });

		expect(res.status).toBe(200);
		expect(commentDeleteManyMock).toHaveBeenCalledTimes(1);
	});

	it("keeps comment deletion working when Post.commentCount column is missing", async () => {
		authMock.mockResolvedValue({ user: { id: "5", role: "user" } });
		commentFindUniqueMock.mockResolvedValue({ id: 1, authorId: 5, postId: 3 });
		commentDeleteManyMock.mockResolvedValue({ count: 2 });
		postFindUniqueMock
			.mockResolvedValueOnce({ tags: null })
			.mockRejectedValueOnce(new Error("SQLITE_UNKNOWN: SQLite error: table Post has no column named commentCount"));
		postUpdateMock.mockResolvedValue({ id: 3 });

		const { DELETE } = await import("@/app/api/comments/[id]/route");
		const req = new Request("http://localhost/api/comments/1", { method: "DELETE" });
		const res = await DELETE(req as never, { params: Promise.resolve({ id: "1" }) });

		expect(res.status).toBe(200);
		expect(postUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: {
					updatedAt: expect.any(Date),
				},
				select: { id: true },
			})
		);
	});
});
