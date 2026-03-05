import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const resolveActiveUserFromSessionMock = vi.fn();
const postFindFirstMock = vi.fn();
const postSubscriptionUpsertMock = vi.fn();
const postSubscriptionDeleteManyMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/active-user", () => ({
	resolveActiveUserFromSession: resolveActiveUserFromSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			findFirst: postFindFirstMock,
		},
		postSubscription: {
			upsert: postSubscriptionUpsertMock,
			deleteMany: postSubscriptionDeleteManyMock,
		},
	},
}));

describe("PATCH /api/posts/[id]/subscription", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		resolveActiveUserFromSessionMock.mockReset();
		postFindFirstMock.mockReset();
		postSubscriptionUpsertMock.mockReset();
		postSubscriptionDeleteManyMock.mockReset();

		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: true,
			context: { userId: 44, role: "user", nickname: "tester", isApproved: 1, isBanned: 0 },
		});
		postFindFirstMock.mockResolvedValue({ id: 12 });
		postSubscriptionUpsertMock.mockResolvedValue({});
		postSubscriptionDeleteManyMock.mockResolvedValue({ count: 1 });
	});

	it("returns 400 when post id is invalid", async () => {
		const { PATCH } = await import("@/app/api/posts/[id]/subscription/route");
		const req = new Request("http://localhost/api/posts/abc/subscription", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: true }),
		});

		const res = await PATCH(req as never, { params: Promise.resolve({ id: "abc" }) });
		expect(res.status).toBe(400);
		expect(postFindFirstMock).not.toHaveBeenCalled();
	});

	it("returns 403 for pending user", async () => {
		authMock.mockResolvedValue({ user: { id: "44" } });
		resolveActiveUserFromSessionMock.mockResolvedValue({ ok: false, status: 403, error: "pending_approval" });

		const { PATCH } = await import("@/app/api/posts/[id]/subscription/route");
		const req = new Request("http://localhost/api/posts/12/subscription", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: true }),
		});

		const res = await PATCH(req as never, { params: Promise.resolve({ id: "12" }) });
		expect(res.status).toBe(403);
		await expect(res.json()).resolves.toEqual({ error: "pending_approval" });
		expect(postFindFirstMock).not.toHaveBeenCalled();
	});

	it("upserts subscription when enabled=true", async () => {
		authMock.mockResolvedValue({ user: { id: "44" } });

		const { PATCH } = await import("@/app/api/posts/[id]/subscription/route");
		const req = new Request("http://localhost/api/posts/12/subscription", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: true }),
		});

		const res = await PATCH(req as never, { params: Promise.resolve({ id: "12" }) });
		expect(res.status).toBe(200);
		expect(postSubscriptionUpsertMock).toHaveBeenCalledTimes(1);
		expect(postSubscriptionDeleteManyMock).not.toHaveBeenCalled();
		await expect(res.json()).resolves.toEqual({ success: true, postId: 12, enabled: true, fallbackLocalOnly: false });
	});

	it("deletes subscription when enabled=false", async () => {
		authMock.mockResolvedValue({ user: { id: "44" } });

		const { PATCH } = await import("@/app/api/posts/[id]/subscription/route");
		const req = new Request("http://localhost/api/posts/12/subscription", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: false }),
		});

		const res = await PATCH(req as never, { params: Promise.resolve({ id: "12" }) });
		expect(res.status).toBe(200);
		expect(postSubscriptionDeleteManyMock).toHaveBeenCalledWith({ where: { userId: 44, postId: 12 } });
		expect(postSubscriptionUpsertMock).not.toHaveBeenCalled();
		await expect(res.json()).resolves.toEqual({ success: true, postId: 12, enabled: false, fallbackLocalOnly: false });
	});

	it("returns fallbackLocalOnly when PostSubscription table is missing", async () => {
		authMock.mockResolvedValue({ user: { id: "44" } });
		postSubscriptionUpsertMock.mockRejectedValue(
			new Error("SQLITE_UNKNOWN: SQLite error: no such table: main.PostSubscription")
		);

		const { PATCH } = await import("@/app/api/posts/[id]/subscription/route");
		const req = new Request("http://localhost/api/posts/12/subscription", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: true }),
		});

		const res = await PATCH(req as never, { params: Promise.resolve({ id: "12" }) });
		expect(res.status).toBe(200);
		await expect(res.json()).resolves.toEqual({ success: true, postId: 12, enabled: true, fallbackLocalOnly: true });
	});

	it("returns 404 when post is missing", async () => {
		authMock.mockResolvedValue({ user: { id: "44" } });
		postFindFirstMock.mockResolvedValue(null);

		const { PATCH } = await import("@/app/api/posts/[id]/subscription/route");
		const req = new Request("http://localhost/api/posts/99/subscription", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ enabled: true }),
		});

		const res = await PATCH(req as never, { params: Promise.resolve({ id: "99" }) });
		expect(res.status).toBe(404);
		await expect(res.json()).resolves.toEqual({ error: "Post not found" });
		expect(postSubscriptionUpsertMock).not.toHaveBeenCalled();
	});
});
