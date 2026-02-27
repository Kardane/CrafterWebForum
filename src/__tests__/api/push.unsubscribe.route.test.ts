import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const authMock = vi.fn();
const enforceRateLimitMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: enforceRateLimitMock }));
vi.mock("@/lib/prisma", () => ({
	prisma: {
		pushSubscription: {
			updateMany: updateManyMock,
		},
	},
}));

describe("POST /api/push/unsubscribe", () => {
	beforeEach(() => {
		authMock.mockReset();
		enforceRateLimitMock.mockReset();
		updateManyMock.mockReset();
		enforceRateLimitMock.mockReturnValue(null);
	});

	it("returns 429 when rate limited", async () => {
		enforceRateLimitMock.mockReturnValue(NextResponse.json({ error: "rate_limited" }, { status: 429 }));
		const { POST } = await import("@/app/api/push/unsubscribe/route");
		const req = new NextRequest("http://localhost/api/push/unsubscribe", {
			method: "POST",
			body: JSON.stringify({}),
		});
		const res = await POST(req);
		expect(res.status).toBe(429);
	});

	it("returns 401 without session", async () => {
		authMock.mockResolvedValue(null);
		const { POST } = await import("@/app/api/push/unsubscribe/route");
		const req = new NextRequest("http://localhost/api/push/unsubscribe", {
			method: "POST",
			body: JSON.stringify({}),
		});
		const res = await POST(req);
		expect(res.status).toBe(401);
	});

	it("returns 400 for invalid endpoint", async () => {
		authMock.mockResolvedValue({ user: { id: "7" } });
		const { POST } = await import("@/app/api/push/unsubscribe/route");
		const req = new NextRequest("http://localhost/api/push/unsubscribe", {
			method: "POST",
			body: JSON.stringify({ endpoint: " " }),
		});
		const res = await POST(req);
		expect(res.status).toBe(400);
		expect(updateManyMock).not.toHaveBeenCalled();
	});

	it("deactivates subscription when endpoint is valid", async () => {
		authMock.mockResolvedValue({ user: { id: "7" } });
		updateManyMock.mockResolvedValue({ count: 1 });
		const { POST } = await import("@/app/api/push/unsubscribe/route");
		const req = new NextRequest("http://localhost/api/push/unsubscribe", {
			method: "POST",
			body: JSON.stringify({ endpoint: "https://example.com/push" }),
		});
		const res = await POST(req);
		expect(res.status).toBe(200);
		expect(updateManyMock).toHaveBeenCalledTimes(1);
	});
});
