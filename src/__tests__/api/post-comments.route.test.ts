import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const postFindFirstMock = vi.fn();
const commentFindFirstMock = vi.fn();
const commentCreateMock = vi.fn();
const commentCountMock = vi.fn();
const postReadUpsertMock = vi.fn();
const postUpdateMock = vi.fn();

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
			findFirst: commentFindFirstMock,
			create: commentCreateMock,
			count: commentCountMock,
		},
		postRead: {
			upsert: postReadUpsertMock,
		},
	},
}));

describe("POST /api/posts/[id]/comments", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		postFindFirstMock.mockReset();
		commentFindFirstMock.mockReset();
		commentCreateMock.mockReset();
		commentCountMock.mockReset();
		postReadUpsertMock.mockReset();
		postUpdateMock.mockReset();
	});

	it("returns 403 when user is pending approval", async () => {
		authMock.mockResolvedValue({ user: { id: "10", isApproved: 0 } });

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
});
