import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const postFindFirstMock = vi.fn();
const likeFindFirstMock = vi.fn();
const likeCreateMock = vi.fn();
const likeDeleteMock = vi.fn();
const postUpdateMock = vi.fn();
const postFindUniqueMock = vi.fn();
const transactionMock = vi.fn();
const resolveActiveUserFromSessionMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			findFirst: postFindFirstMock,
			update: postUpdateMock,
		},
		like: {
			findUnique: likeFindFirstMock,
			create: likeCreateMock,
			delete: likeDeleteMock,
		},
		$transaction: transactionMock,
	},
}));

vi.mock("@/lib/active-user", () => ({
	resolveActiveUserFromSession: resolveActiveUserFromSessionMock,
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
		transactionMock.mockReset();
		resolveActiveUserFromSessionMock.mockReset();
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: true,
			context: { userId: 9, role: "user", nickname: "tester", isApproved: 1, isBanned: 0 },
		});
		transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) =>
			callback({
				like: {
					findUnique: likeFindFirstMock,
					create: likeCreateMock,
					delete: likeDeleteMock,
				},
				post: {
					update: postUpdateMock,
				},
			})
		);
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);
		resolveActiveUserFromSessionMock.mockResolvedValue({ ok: false, status: 401, error: "unauthorized" });
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
		postUpdateMock.mockResolvedValue({ likes: 3 });

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
