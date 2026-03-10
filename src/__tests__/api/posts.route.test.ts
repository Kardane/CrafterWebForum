import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const postCreateMock = vi.fn();
const postSubscriptionUpsertMock = vi.fn();
const resolveActiveUserFromSessionMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			create: postCreateMock,
		},
		postSubscription: {
			upsert: postSubscriptionUpsertMock,
		},
	},
}));

vi.mock("@/lib/active-user", () => ({
	resolveActiveUserFromSession: resolveActiveUserFromSessionMock,
}));

describe("POST /api/posts", () => {
	beforeEach(() => {
	authMock.mockReset();
	postCreateMock.mockReset();
	postSubscriptionUpsertMock.mockReset();
	resolveActiveUserFromSessionMock.mockReset();
	resolveActiveUserFromSessionMock.mockResolvedValue({
		ok: true,
		context: { userId: 5, role: "user", nickname: "tester", isApproved: 1, isBanned: 0 },
	});
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);
		resolveActiveUserFromSessionMock.mockResolvedValue({ ok: false, status: 401, error: "unauthorized" });

		const { POST } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "hello", content: "world" }),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(401);
	});

	it("returns 400 when required fields are missing", async () => {
		authMock.mockResolvedValue({ user: { id: 7 } });

		const { POST } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "x" }),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(400);
	});

	it("uses session user id instead of client authorId", async () => {
		authMock.mockResolvedValue({ user: { id: "5" } });
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: true,
			context: { userId: 5, role: "user", nickname: "tester", isApproved: 1, isBanned: 0 },
		});
		postCreateMock.mockResolvedValue({ id: 123 });
		postSubscriptionUpsertMock.mockResolvedValue({ userId: 5, postId: 123 });

		const { POST } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "secure title",
				content: "secure content",
				tags: ["news"],
				authorId: 999999,
			}),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(200);
		expect(postCreateMock).toHaveBeenCalledTimes(1);
		expect(postCreateMock).toHaveBeenCalledWith({
			data: {
				title: "secure title",
				content: "secure content",
				board: "develope",
				serverAddress: null,
				tags: "[\"news\"]",
				commentCount: 0,
				authorId: 5,
			},
		});
		expect(postSubscriptionUpsertMock).toHaveBeenCalledWith({
			where: {
				userId_postId: {
					userId: 5,
					postId: 123,
				},
			},
			update: {
				updatedAt: expect.any(Date),
			},
			create: {
				userId: 5,
				postId: 123,
			},
		});
	});

	it("creates sinmungo posts with serverAddress metadata", async () => {
		authMock.mockResolvedValue({ user: { id: "5" } });
		postCreateMock.mockResolvedValue({ id: 777 });
		postSubscriptionUpsertMock.mockResolvedValue({ userId: 5, postId: 777 });

		const { POST } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "서버 신고",
				content: "문제 있음",
				board: "sinmungo",
				serverAddress: "mc.example.com:25565",
				tags: [],
			}),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(200);
		expect(postCreateMock).toHaveBeenCalledWith({
			data: {
				title: "서버 신고",
				content: "문제 있음",
				board: "sinmungo",
				serverAddress: "mc.example.com:25565",
				tags: '["__sys:server:mc.example.com:25565","__sys:board:ombudsman"]',
				commentCount: 0,
				authorId: 5,
			},
		});
	});

	it("rejects sinmungo posts without serverAddress", async () => {
		authMock.mockResolvedValue({ user: { id: "5" } });

		const { POST } = await import("@/app/api/posts/route");
		const req = new Request("http://localhost/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "서버 신고",
				content: "문제 있음",
				board: "sinmungo",
				tags: [],
			}),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(400);
		expect(postCreateMock).not.toHaveBeenCalled();
	});

});
