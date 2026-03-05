import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const enforceRateLimitAsyncMock = vi.fn();
const parseServerAddressMock = vi.fn();
const isMinecraftServerReachableMock = vi.fn();
const resolvePublicIpsMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
	enforceRateLimitAsync: enforceRateLimitAsyncMock,
}));

vi.mock("@/lib/server-address", () => ({
	parseServerAddress: parseServerAddressMock,
}));

vi.mock("@/lib/minecraft-server-check", () => ({
	isMinecraftServerReachable: isMinecraftServerReachableMock,
}));

vi.mock("@/lib/network-guard", () => ({
	resolvePublicIps: resolvePublicIpsMock,
}));

describe("GET /api/server-address/check", () => {
	beforeEach(() => {
		enforceRateLimitAsyncMock.mockReset();
		parseServerAddressMock.mockReset();
		isMinecraftServerReachableMock.mockReset();
		resolvePublicIpsMock.mockReset();

		enforceRateLimitAsyncMock.mockResolvedValue(null);
		resolvePublicIpsMock.mockResolvedValue(["203.0.113.10"]);
	});

	it("returns 429 when rate-limited", async () => {
		enforceRateLimitAsyncMock.mockResolvedValue(NextResponse.json({ error: "too_many_requests" }, { status: 429 }));

		const { GET } = await import("@/app/api/server-address/check/route");
		const req = new NextRequest("http://localhost/api/server-address/check?address=mc.example.com:25565");

		const res = await GET(req);
		expect(res.status).toBe(429);
	});

	it("returns 400 for invalid server address", async () => {
		parseServerAddressMock.mockReturnValue(null);

		const { GET } = await import("@/app/api/server-address/check/route");
		const req = new NextRequest("http://localhost/api/server-address/check?address=invalid");

		const res = await GET(req);
		expect(res.status).toBe(400);
		expect(isMinecraftServerReachableMock).not.toHaveBeenCalled();
	});

	it("returns 400 for blocked/private resolved addresses", async () => {
		parseServerAddressMock.mockReturnValue({
			host: "mc.example.com",
			port: 25565,
			normalizedAddress: "mc.example.com:25565",
		});
		resolvePublicIpsMock.mockRejectedValue(new Error("blocked_ip"));

		const { GET } = await import("@/app/api/server-address/check/route");
		const req = new NextRequest("http://localhost/api/server-address/check?address=mc.example.com:25565");

		const res = await GET(req);
		expect(res.status).toBe(400);
		expect(isMinecraftServerReachableMock).not.toHaveBeenCalled();
	});

	it("returns open=true with normalized address", async () => {
		parseServerAddressMock.mockReturnValue({
			host: "mc.example.com",
			port: 25565,
			normalizedAddress: "mc.example.com:25565",
		});
		isMinecraftServerReachableMock.mockResolvedValue(true);

		const { GET } = await import("@/app/api/server-address/check/route");
		const req = new NextRequest("http://localhost/api/server-address/check?address=mc.example.com:25565");

		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; open: boolean; normalizedAddress: string };
		expect(body).toMatchObject({
			ok: true,
			open: true,
			normalizedAddress: "mc.example.com:25565",
		});
	});

	it("returns open=false when server is unreachable", async () => {
		parseServerAddressMock.mockReturnValue({
			host: "mc.example.com",
			port: 25565,
			normalizedAddress: "mc.example.com:25565",
		});
		isMinecraftServerReachableMock.mockResolvedValue(false);

		const { GET } = await import("@/app/api/server-address/check/route");
		const req = new NextRequest("http://localhost/api/server-address/check?address=mc.example.com:25565");

		const res = await GET(req);
		expect(res.status).toBe(200);
		const body = (await res.json()) as { ok: boolean; open: boolean };
		expect(body.ok).toBe(true);
		expect(body.open).toBe(false);
	});
});
