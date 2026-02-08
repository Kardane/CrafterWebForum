import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const postFindFirstMock = vi.fn();
const likeFindFirstMock = vi.fn();
const likeCreateMock = vi.fn();
const likeDeleteMock = vi.fn();
const postUpdateMock = vi.fn();
const postFindUniqueMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			findFirst: postFindFirstMock,
			update: postUpdateMock,
			findUnique: postFindUniqueMock,
		},
		like: {
			findFirst: likeFindFirstMock,
			create: likeCreateMock,
			delete: likeDeleteMock,
		},
	},
}));

describe("POST /api/posts/[id]/like", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		postFindFirstMock.mockReset();
		likeFindFirstMock.mockReset();
		likeCreateMock.mockReset();
		likeDeleteMock.mockReset();
		postUpdateMock.mockReset();
		postFindUniqueMock.mockReset();
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);
		const { POST } = await import("@/app/api/posts/[id]/like/route");
		const req = new Request("http://localhost/api/posts/1/like", { method: "POST" });
		const res = await POST(req as never, { params: Promise.resolve({ id: "1" }) });
		expect(res.status).toBe(401);
	});

	it("normalizes string session id and creates like", async () => {
		authMock.mockResolvedValue({ user: { id: "9" } });
		postFindFirstMock.mockResolvedValue({ id: 1 });
		likeFindFirstMock.mockResolvedValue(null);
		likeCreateMock.mockResolvedValue({ id: 100 });
		postUpdateMock.mockResolvedValue({});
		postFindUniqueMock.mockResolvedValue({ likes: 3 });

		const { POST } = await import("@/app/api/posts/[id]/like/route");
		const req = new Request("http://localhost/api/posts/1/like", { method: "POST" });
		const res = await POST(req as never, { params: Promise.resolve({ id: "1" }) });
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(likeCreateMock).toHaveBeenCalledWith({
			data: {
				postId: 1,
				userId: 9,
			},
		});
		expect(body.liked).toBe(true);
		expect(body.likes).toBe(3);
	});
});
