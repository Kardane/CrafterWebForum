import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deleteManyMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();
const verifySecret = "minecraft-verify-secret-with-at-least-32-chars";

function verifyHeaders() {
	return {
		"Content-Type": "application/json",
		Authorization: `Bearer ${verifySecret}`,
	};
}

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
		vi.stubEnv("MINECRAFT_VERIFY_SECRET", verifySecret);
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns 503 when minecraft verify secret is not configured", async () => {
		vi.stubEnv("MINECRAFT_VERIFY_SECRET", "");

		const { POST } = await import("@/app/api/minecraft/verify/route");
		const req = new Request("http://localhost/api/minecraft/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				code: "AB12CD3",
				uuid: "u",
				nickname: "nick",
			}),
		});

		const res = await POST(req as never);
		const body = await res.json();
		expect(res.status).toBe(503);
		expect(body.error).toBe("minecraft_verify_not_configured");
		expect(deleteManyMock).not.toHaveBeenCalled();
		expect(updateMock).not.toHaveBeenCalled();
	});

	it("returns 401 when authorization header is missing", async () => {
		const { POST } = await import("@/app/api/minecraft/verify/route");
		const req = new Request("http://localhost/api/minecraft/verify", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				code: "AB12CD3",
				uuid: "u",
				nickname: "nick",
			}),
		});

		const res = await POST(req as never);
		const body = await res.json();
		expect(res.status).toBe(401);
		expect(body.error).toBe("unauthorized");
		expect(deleteManyMock).not.toHaveBeenCalled();
		expect(updateMock).not.toHaveBeenCalled();
	});

	it("allows missing authorization from configured minecraft server IP", async () => {
		vi.stubEnv("MINECRAFT_VERIFY_ALLOWED_IPS", "172.65.204.41");
		deleteManyMock.mockResolvedValue({ count: 0 });
		findUniqueMock.mockResolvedValue({ code: "AB12CD3", ipAddress: "9.9.9.9" });
		updateMock.mockResolvedValue({});

		const { POST } = await import("@/app/api/minecraft/verify/route");
		const req = new Request("http://localhost/api/minecraft/verify", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-vercel-forwarded-for": "172.65.204.41",
			},
			body: JSON.stringify({
				code: "AB12CD3",
				uuid: "u",
				nickname: "nick",
			}),
		});

		const res = await POST(req as never);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.success).toBe(true);
		expect(updateMock).toHaveBeenCalledTimes(1);
	});

	it("returns 401 when authorization header is invalid", async () => {
		vi.stubEnv("MINECRAFT_VERIFY_ALLOWED_IPS", "172.65.204.41");
		const { POST } = await import("@/app/api/minecraft/verify/route");
		const req = new Request("http://localhost/api/minecraft/verify", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer wrong-secret",
				"x-vercel-forwarded-for": "172.65.204.41",
			},
			body: JSON.stringify({
				code: "AB12CD3",
				uuid: "u",
				nickname: "nick",
			}),
		});

		const res = await POST(req as never);
		const body = await res.json();
		expect(res.status).toBe(401);
		expect(body.error).toBe("unauthorized");
		expect(deleteManyMock).not.toHaveBeenCalled();
		expect(updateMock).not.toHaveBeenCalled();
	});

	it("returns 400 when body is missing required fields", async () => {
		const { POST } = await import("@/app/api/minecraft/verify/route");
		const req = new Request("http://localhost/api/minecraft/verify", {
			method: "POST",
			headers: verifyHeaders(),
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
			headers: verifyHeaders(),
			body: JSON.stringify({
				code: "ab12cd3",
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

	it("accepts verify even when stored IP differs (IP mismatch disabled)", async () => {
		deleteManyMock.mockResolvedValue({ count: 0 });
		findUniqueMock.mockResolvedValue({ code: "AB12CD3", ipAddress: "9.9.9.9" });
		updateMock.mockResolvedValue({});

		const { POST } = await import("@/app/api/minecraft/verify/route");
		const req = new Request("http://localhost/api/minecraft/verify", {
			method: "POST",
			headers: verifyHeaders(),
			body: JSON.stringify({
				code: "AB12CD3",
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

	it("normalizes code to uppercase before lookup", async () => {
		deleteManyMock.mockResolvedValue({ count: 0 });
		findUniqueMock.mockResolvedValue({ code: "AB12CD3", ipAddress: "reauth:42" });
		updateMock.mockResolvedValue({});

		const { POST } = await import("@/app/api/minecraft/verify/route");
		const req = new Request("http://localhost/api/minecraft/verify", {
			method: "POST",
			headers: verifyHeaders(),
			body: JSON.stringify({
				code: "ab12cd3",
				uuid: "u",
				nickname: "nick",
				ip: "1.1.1.1",
			}),
		});

		const res = await POST(req as never);
		const body = await res.json();
		expect(res.status).toBe(200);
		expect(body.success).toBe(true);
		expect(findUniqueMock).toHaveBeenCalledWith({ where: { code: "AB12CD3" } });
		expect(updateMock).toHaveBeenCalledTimes(1);
	});
});
