// @vitest-environment node

import { jwtVerify } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const resolveActiveUserFromSessionMock = vi.fn();
const enforceRateLimitAsyncMock = vi.fn();

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/active-user", () => ({
	resolveActiveUserFromSession: resolveActiveUserFromSessionMock,
}));
vi.mock("@/lib/rate-limit", () => ({
	enforceRateLimitAsync: enforceRateLimitAsyncMock,
}));

describe("GET /api/realtime/token", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		resolveActiveUserFromSessionMock.mockReset();
		enforceRateLimitAsyncMock.mockReset();
		process.env.REALTIME_JWT_SECRET = "test-realtime-jwt-secret-32-chars";

		authMock.mockResolvedValue({ user: { id: "12" } });
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: true,
			context: {
				userId: 12,
				role: "admin",
				nickname: "관리자",
				isApproved: 1,
				isBanned: 0,
			},
		});
		enforceRateLimitAsyncMock.mockResolvedValue(null);
	});

	it("비로그인 사용자는 401을 반환한다", async () => {
		authMock.mockResolvedValue(null);
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: false,
			status: 401,
			error: "unauthorized",
		});

		const { GET } = await import("@/app/api/realtime/token/route");
		const res = await GET(new NextRequest("http://localhost/api/realtime/token"));

		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
		expect(enforceRateLimitAsyncMock).not.toHaveBeenCalled();
	});

	it("승인 대기 사용자는 403을 반환한다", async () => {
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: false,
			status: 403,
			error: "pending_approval",
		});

		const { GET } = await import("@/app/api/realtime/token/route");
		const res = await GET(new NextRequest("http://localhost/api/realtime/token"));

		expect(res.status).toBe(403);
		await expect(res.json()).resolves.toEqual({ error: "pending_approval" });
	});

	it("차단 사용자는 403을 반환한다", async () => {
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: false,
			status: 403,
			error: "banned_user",
		});

		const { GET } = await import("@/app/api/realtime/token/route");
		const res = await GET(new NextRequest("http://localhost/api/realtime/token"));

		expect(res.status).toBe(403);
		await expect(res.json()).resolves.toEqual({ error: "banned_user" });
	});

	it("정상 사용자는 10분짜리 realtime JWT를 받는다", async () => {
		const { GET } = await import("@/app/api/realtime/token/route");
		const res = await GET(new NextRequest("http://localhost/api/realtime/token"));

		expect(res.status).toBe(200);
		const body = (await res.json()) as { token: string; expiresIn: number };
		const { payload } = await jwtVerify(
			body.token,
			new TextEncoder().encode("test-realtime-jwt-secret-32-chars")
		);

		expect(body.expiresIn).toBe(600);
		expect(payload.sub).toBe("12");
		expect(payload.userId).toBe(12);
		expect(payload.role).toBe("admin");
		expect(Number(payload.exp) - Number(payload.iat)).toBe(600);
		expect(enforceRateLimitAsyncMock).toHaveBeenCalledWith(
			expect.any(NextRequest),
			expect.objectContaining({ namespace: "realtime:token" }),
			"user:12"
		);
	});

	it("JWT secret이 없으면 500을 반환한다", async () => {
		delete process.env.REALTIME_JWT_SECRET;

		const { GET } = await import("@/app/api/realtime/token/route");
		const res = await GET(new NextRequest("http://localhost/api/realtime/token"));

		expect(res.status).toBe(500);
		await expect(res.json()).resolves.toEqual({ error: "realtime_unavailable" });
	});

	it("rate limit에 걸리면 429 응답을 그대로 반환한다", async () => {
		enforceRateLimitAsyncMock.mockResolvedValue(
			NextResponse.json({ error: "rate_limited" }, { status: 429 })
		);

		const { GET } = await import("@/app/api/realtime/token/route");
		const res = await GET(new NextRequest("http://localhost/api/realtime/token"));

		expect(res.status).toBe(429);
		await expect(res.json()).resolves.toEqual({ error: "rate_limited" });
	});
});
