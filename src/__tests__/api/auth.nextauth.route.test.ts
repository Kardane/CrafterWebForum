import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const handlerGetMock = vi.fn();
const handlerPostMock = vi.fn();
const enforceRateLimitMock = vi.fn();

vi.mock("@/auth", () => ({
	handlers: {
		GET: handlerGetMock,
		POST: handlerPostMock,
	},
}));

vi.mock("@/lib/rate-limit", () => ({
	enforceRateLimit: enforceRateLimitMock,
}));

describe("/api/auth/[...nextauth] route", () => {
	beforeEach(() => {
		handlerGetMock.mockReset();
		handlerPostMock.mockReset();
		enforceRateLimitMock.mockReset();

		handlerGetMock.mockResolvedValue(NextResponse.json({ ok: true }, { status: 200 }));
		handlerPostMock.mockResolvedValue(NextResponse.json({ ok: true }, { status: 200 }));
		enforceRateLimitMock.mockReturnValue(null);
	});

	it("delegates GET to NextAuth handlers", async () => {
		const { GET } = await import("@/app/api/auth/[...nextauth]/route");
		const req = new Request("http://localhost/api/auth/session", {
			method: "GET",
		}) as NextRequest;

		const res = await GET(req);

		expect(res.status).toBe(200);
		expect(handlerGetMock).toHaveBeenCalledTimes(1);
		expect(enforceRateLimitMock).not.toHaveBeenCalled();
	});

	it("returns 429 when credentials callback is rate-limited", async () => {
		enforceRateLimitMock.mockReturnValue(
			NextResponse.json({ error: "rate_limited" }, { status: 429 })
		);

		const { POST } = await import("@/app/api/auth/[...nextauth]/route");
		const req = new Request("http://localhost/api/auth/callback/credentials", {
			method: "POST",
		}) as NextRequest;

		const res = await POST(req);

		expect(res.status).toBe(429);
		expect(enforceRateLimitMock).toHaveBeenCalledTimes(1);
		expect(handlerPostMock).not.toHaveBeenCalled();
	});

	it("skips login rate limit for non-credential auth POST", async () => {
		const { POST } = await import("@/app/api/auth/[...nextauth]/route");
		const req = new Request("http://localhost/api/auth/signout", {
			method: "POST",
		}) as NextRequest;

		const res = await POST(req);

		expect(res.status).toBe(200);
		expect(enforceRateLimitMock).not.toHaveBeenCalled();
		expect(handlerPostMock).toHaveBeenCalledTimes(1);
	});
});
