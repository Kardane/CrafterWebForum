import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const countMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
	prisma: {
		minecraftCode: {
			count: countMock,
		},
	},
}));

describe("GET /api/minecraft/status", () => {
	beforeEach(() => {
		countMock.mockReset();
		vi.stubEnv("MINECRAFT_VERIFY_SECRET", "minecraft-verify-secret-with-at-least-32-chars");
		vi.stubEnv("MINECRAFT_VERIFY_ALLOWED_IPS", "stevegallery.kr");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns 200 and ok true when DB query succeeds", async () => {
		countMock.mockResolvedValue(1);

		const { GET } = await import("@/app/api/minecraft/status/route");
		const req = new Request("http://localhost/api/minecraft/status");
		const res = await GET(req as never);
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.db).toBe("ok");
		expect(body.verify).toBe("ok");
		expect(body.allowedSources).toBe(1);
		expect(res.headers.get("cache-control")).toBe("no-store");
	});

	it("returns 200 and db error when DB query fails", async () => {
		countMock.mockRejectedValue(new Error("db down"));

		const { GET } = await import("@/app/api/minecraft/status/route");
		const req = new Request("http://localhost/api/minecraft/status");
		const res = await GET(req as never);
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.db).toBe("error");
		expect(body.verify).toBe("ok");
		expect(body.allowedSources).toBe(1);
	});

	it("reports when minecraft verify secret is not configured", async () => {
		vi.stubEnv("MINECRAFT_VERIFY_SECRET", "");
		countMock.mockResolvedValue(1);

		const { GET } = await import("@/app/api/minecraft/status/route");
		const req = new Request("http://localhost/api/minecraft/status");
		const res = await GET(req as never);
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.ok).toBe(true);
		expect(body.db).toBe("ok");
		expect(body.verify).toBe("not_configured");
		expect(body.allowedSources).toBe(1);
	});

	it("rate limits callers", async () => {
		countMock.mockResolvedValue(1);

		const { GET } = await import("@/app/api/minecraft/status/route");

		let lastStatus = 0;
		for (let i = 0; i < 70; i += 1) {
			const req = new Request("http://localhost/api/minecraft/status", {
				headers: { "x-forwarded-for": "1.2.3.4" },
			});
			const res = await GET(req as never);
			lastStatus = res.status;
			if (res.status === 429) break;
		}

		expect(lastStatus).toBe(429);
	});
});

