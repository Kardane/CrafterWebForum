import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const authMock = vi.fn();
const enforceRateLimitAsyncMock = vi.fn();
const upsertMock = vi.fn();
const findManyMock = vi.fn();
const findUniqueMock = vi.fn();
const parsePushSubscriptionPayloadAsyncMock = vi.fn();
const resolveActiveUserFromSessionMock = vi.fn();

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimitAsync: enforceRateLimitAsyncMock }));
vi.mock("@/lib/prisma", () => ({
	prisma: {
		pushSubscription: {
			upsert: upsertMock,
			findMany: findManyMock,
			findUnique: findUniqueMock,
		},
	},
}));
vi.mock("@/lib/push", () => ({
	parsePushSubscriptionPayloadAsync: parsePushSubscriptionPayloadAsyncMock,
}));
vi.mock("@/lib/active-user", () => ({
	resolveActiveUserFromSession: resolveActiveUserFromSessionMock,
}));

describe("POST /api/push/subscribe", () => {
	beforeEach(() => {
		authMock.mockReset();
		enforceRateLimitAsyncMock.mockReset();
		upsertMock.mockReset();
		findManyMock.mockReset();
		findUniqueMock.mockReset();
		parsePushSubscriptionPayloadAsyncMock.mockReset();
		resolveActiveUserFromSessionMock.mockReset();
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: true,
			context: { userId: 10, role: "user", nickname: "tester", isApproved: 1, isBanned: 0 },
		});
		enforceRateLimitAsyncMock.mockResolvedValue(null);
	});

	it("returns 401 on GET without session", async () => {
		authMock.mockResolvedValue(null);
		resolveActiveUserFromSessionMock.mockResolvedValue({ ok: false, status: 401, error: "unauthorized" });
		const { GET } = await import("@/app/api/push/subscribe/route");
		const req = new NextRequest("http://localhost/api/push/subscribe");
		const res = await GET(req);
		expect(res.status).toBe(401);
	});

	it("returns active subscriptions on GET", async () => {
		authMock.mockResolvedValue({ user: { id: "10" } });
		findManyMock.mockResolvedValue([
			{
				id: 1,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			},
		]);
		const { GET } = await import("@/app/api/push/subscribe/route");
		const req = new NextRequest("http://localhost/api/push/subscribe");
		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { subscriptions: unknown[] };
		expect(body.subscriptions).toHaveLength(1);
	});

	it("returns 429 on GET when rate limited", async () => {
		authMock.mockResolvedValue({ user: { id: "10" } });
		enforceRateLimitAsyncMock.mockResolvedValue(NextResponse.json({ error: "rate_limited" }, { status: 429 }));
		const { GET } = await import("@/app/api/push/subscribe/route");
		const req = new NextRequest("http://localhost/api/push/subscribe");
		const res = await GET(req);
		expect(res.status).toBe(429);
	});

	it("returns 429 when rate limited", async () => {
		enforceRateLimitAsyncMock.mockResolvedValue(NextResponse.json({ error: "rate_limited" }, { status: 429 }));
		const { POST } = await import("@/app/api/push/subscribe/route");
		const req = new NextRequest("http://localhost/api/push/subscribe", {
			method: "POST",
			body: JSON.stringify({}),
		});
		const res = await POST(req);
		expect(res.status).toBe(429);
	});

	it("returns 401 without session", async () => {
		authMock.mockResolvedValue(null);
		resolveActiveUserFromSessionMock.mockResolvedValue({ ok: false, status: 401, error: "unauthorized" });
		const { POST } = await import("@/app/api/push/subscribe/route");
		const req = new NextRequest("http://localhost/api/push/subscribe", {
			method: "POST",
			body: JSON.stringify({}),
		});
		const res = await POST(req);
		expect(res.status).toBe(401);
	});

	it("returns 400 for invalid payload", async () => {
		authMock.mockResolvedValue({ user: { id: "10" } });
		parsePushSubscriptionPayloadAsyncMock.mockResolvedValue(null);
		const { POST } = await import("@/app/api/push/subscribe/route");
		const req = new NextRequest("http://localhost/api/push/subscribe", {
			method: "POST",
			body: JSON.stringify({ endpoint: "" }),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
		expect(upsertMock).not.toHaveBeenCalled();
	});

	it("upserts subscription on valid payload", async () => {
		authMock.mockResolvedValue({ user: { id: "10" } });
		findUniqueMock.mockResolvedValue(null);
		parsePushSubscriptionPayloadAsyncMock.mockResolvedValue({
			endpoint: "https://example.com/push",
			keys: { p256dh: "p", auth: "a" },
		});
		upsertMock.mockResolvedValue({ id: 1 });
		const { POST } = await import("@/app/api/push/subscribe/route");
		const req = new NextRequest("http://localhost/api/push/subscribe", {
			method: "POST",
			headers: { "user-agent": "vitest" },
			body: JSON.stringify({ endpoint: "https://example.com/push" }),
		});
		const res = await POST(req);
		expect(res.status).toBe(200);
		expect(upsertMock).toHaveBeenCalledTimes(1);
	});

	it("returns 409 when endpoint belongs to another user", async () => {
		authMock.mockResolvedValue({ user: { id: "10" } });
		findUniqueMock.mockResolvedValue({ userId: 99 });
		parsePushSubscriptionPayloadAsyncMock.mockResolvedValue({
			endpoint: "https://example.com/push",
			keys: { p256dh: "p", auth: "a" },
		});

		const { POST } = await import("@/app/api/push/subscribe/route");
		const req = new NextRequest("http://localhost/api/push/subscribe", {
			method: "POST",
			body: JSON.stringify({ endpoint: "https://example.com/push" }),
		});
		const res = await POST(req);
		expect(res.status).toBe(409);
		expect(upsertMock).not.toHaveBeenCalled();
	});
});
