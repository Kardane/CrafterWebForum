import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const enforceRateLimitMock = vi.fn();
const findUniqueCodeMock = vi.fn();
const deleteCodeMock = vi.fn();
const findFirstUserMock = vi.fn();
const updateUserMock = vi.fn();
const transactionMock = vi.fn();
const hashMock = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
	enforceRateLimit: enforceRateLimitMock,
}));

vi.mock("bcryptjs", () => ({
	hash: hashMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		minecraftCode: {
			findUnique: findUniqueCodeMock,
			delete: deleteCodeMock,
		},
		user: {
			findFirst: findFirstUserMock,
			update: updateUserMock,
		},
		$transaction: transactionMock,
	},
}));

describe("POST /api/auth/password/forgot", () => {
	beforeEach(() => {
		enforceRateLimitMock.mockReset();
		findUniqueCodeMock.mockReset();
		deleteCodeMock.mockReset();
		findFirstUserMock.mockReset();
		updateUserMock.mockReset();
		transactionMock.mockReset();
		hashMock.mockReset();

		enforceRateLimitMock.mockReturnValue(null);
		updateUserMock.mockResolvedValue({ id: 1 });
		deleteCodeMock.mockResolvedValue({ code: "AB12CD3" });
		transactionMock.mockResolvedValue(undefined);
		hashMock.mockResolvedValue("hashed-password");
	});

	it("returns 429 when rate-limited", async () => {
		enforceRateLimitMock.mockReturnValue(
			NextResponse.json({ error: "too_many_requests" }, { status: 429 })
		);

		const { POST } = await import("@/app/api/auth/password/forgot/route");
		const req = new Request("http://localhost/api/auth/password/forgot", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "AB12CD3", newPassword: "password1!" }),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(429);
	});

	it("returns 400 when payload is invalid", async () => {
		const { POST } = await import("@/app/api/auth/password/forgot/route");
		const req = new Request("http://localhost/api/auth/password/forgot", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "AB12CD3", newPassword: "short" }),
		});

		const res = await POST(req as never);
		const body = (await res.json()) as { error?: string };
		expect(res.status).toBe(400);
		expect(body.error).toBe("validation_error");
		expect(findUniqueCodeMock).not.toHaveBeenCalled();
	});

	it("returns 400 when body is not valid JSON", async () => {
		const { POST } = await import("@/app/api/auth/password/forgot/route");
		const req = new Request("http://localhost/api/auth/password/forgot", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: "{not-json}",
		});

		const res = await POST(req as never);
		const body = (await res.json()) as { error?: string };
		expect(res.status).toBe(400);
		expect(body.error).toBe("validation_error");
		expect(findUniqueCodeMock).not.toHaveBeenCalled();
	});

	it("returns 400 when code is missing, not verified, or expired", async () => {
		findUniqueCodeMock.mockResolvedValue(null);

		const { POST } = await import("@/app/api/auth/password/forgot/route");
		const req = new Request("http://localhost/api/auth/password/forgot", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "AB12CD3", newPassword: "password1!" }),
		});

		const res = await POST(req as never);
		const body = (await res.json()) as { error?: string };
		expect(res.status).toBe(400);
		expect(body.error).toBe("recovery_verification_failed");
	});

	it("returns 400 when verified nickname has no active user", async () => {
		findUniqueCodeMock.mockResolvedValue({
			code: "AB12CD3",
			isVerified: true,
			linkedNickname: "tester",
			createdAt: new Date(),
		});
		findFirstUserMock.mockResolvedValue(null);

		const { POST } = await import("@/app/api/auth/password/forgot/route");
		const req = new Request("http://localhost/api/auth/password/forgot", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "AB12CD3", newPassword: "password1!" }),
		});

		const res = await POST(req as never);
		const body = (await res.json()) as { error?: string };
		expect(res.status).toBe(400);
		expect(body.error).toBe("recovery_verification_failed");
	});

	it("resets password with normalized code for verified nickname", async () => {
		findUniqueCodeMock.mockResolvedValue({
			code: "AB12CD3",
			isVerified: true,
			linkedNickname: "tester",
			createdAt: new Date(),
		});
		findFirstUserMock.mockResolvedValue({ id: 42 });

		const { POST } = await import("@/app/api/auth/password/forgot/route");
		const req = new Request("http://localhost/api/auth/password/forgot", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ code: "ab12cd3", newPassword: "password1!" }),
		});

		const res = await POST(req as never);
		const body = (await res.json()) as { success?: boolean };

		expect(res.status).toBe(200);
		expect(body.success).toBe(true);
		expect(findUniqueCodeMock).toHaveBeenCalledWith({
			where: { code: "AB12CD3" },
			select: {
				code: true,
				isVerified: true,
				linkedNickname: true,
				createdAt: true,
			},
		});
		expect(updateUserMock).toHaveBeenCalledWith({
			where: { id: 42 },
			data: {
				password: "hashed-password",
				lastAuthAt: expect.any(Date),
			},
		});
		expect(deleteCodeMock).toHaveBeenCalledWith({
			where: { code: "AB12CD3" },
		});
		expect(transactionMock).toHaveBeenCalledTimes(1);
	});
});
