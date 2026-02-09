import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteManyMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
	prisma: {
		minecraftCode: {
			deleteMany: deleteManyMock,
			findUnique: findUniqueMock,
			update: updateMock,
		},
	},
}));

describe("POST /api/minecraft/verify", () => {
	beforeEach(() => {
		deleteManyMock.mockReset();
		findUniqueMock.mockReset();
		updateMock.mockReset();
	});

	it("returns 400 when body is missing required fields", async () => {
		const { POST } = await import("@/app/api/minecraft/verify/route");
		const req = new Request("http://localhost/api/minecraft/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(400);
	});

	it("returns 400 when code is invalid", async () => {
		deleteManyMock.mockResolvedValue({ count: 0 });
		findUniqueMock.mockResolvedValue(null);

		const { POST } = await import("@/app/api/minecraft/verify/route");
		const req = new Request("http://localhost/api/minecraft/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				code: "123456",
				uuid: "u",
				nickname: "nick",
				ip: "1.1.1.1",
			}),
		});

		const res = await POST(req as never);
		const body = await res.json();
		expect(res.status).toBe(400);
		expect(body.error).toBe("invalid_code");
	});

	it("returns 400 ip_mismatch for signup codes with stored IP", async () => {
		deleteManyMock.mockResolvedValue({ count: 0 });
		findUniqueMock.mockResolvedValue({ code: "123456", ipAddress: "9.9.9.9" });

		const { POST } = await import("@/app/api/minecraft/verify/route");
		const req = new Request("http://localhost/api/minecraft/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				code: "123456",
				uuid: "u",
				nickname: "nick",
				ip: "1.1.1.1",
			}),
		});

		const res = await POST(req as never);
		const body = await res.json();
		expect(res.status).toBe(400);
		expect(body.error).toBe("ip_mismatch");
		expect(updateMock).not.toHaveBeenCalled();
	});

	it("skips ip_mismatch for reauth marker codes", async () => {
		deleteManyMock.mockResolvedValue({ count: 0 });
		findUniqueMock.mockResolvedValue({ code: "123456", ipAddress: "reauth:42" });
		updateMock.mockResolvedValue({});

		const { POST } = await import("@/app/api/minecraft/verify/route");
		const req = new Request("http://localhost/api/minecraft/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				code: "123456",
				uuid: "u",
				nickname: "nick",
				ip: "1.1.1.1",
			}),
		});

		const res = await POST(req as never);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.success).toBe(true);
		expect(updateMock).toHaveBeenCalledTimes(1);
	});
});

