import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const commentFindUniqueMock = vi.fn();
const commentUpdateMock = vi.fn();
const commentDeleteManyMock = vi.fn();

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
	},
}));

describe("PATCH /api/comments/[id]", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		commentFindUniqueMock.mockReset();
		commentUpdateMock.mockReset();
		commentDeleteManyMock.mockReset();
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
});
