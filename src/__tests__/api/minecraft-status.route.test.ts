import { beforeEach, describe, expect, it, vi } from "vitest";

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

