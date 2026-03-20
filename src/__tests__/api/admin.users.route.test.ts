import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const findManyMock = vi.fn();
const countMock = vi.fn();
const findFirstMock = vi.fn();
const createMock = vi.fn();
const broadcastRealtimeMock = vi.fn();
const hashMock = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
	requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		user: {
			findMany: findManyMock,
			count: countMock,
			findFirst: findFirstMock,
			create: createMock,
		},
	},
}));

vi.mock("@/lib/realtime/server-broadcast", () => ({
	broadcastRealtime: broadcastRealtimeMock,
}));

vi.mock("bcryptjs", () => ({
	hash: hashMock,
}));

describe("POST /api/admin/users", () => {
	beforeEach(() => {
		requireAdminMock.mockReset();
		findManyMock.mockReset();
		countMock.mockReset();
		findFirstMock.mockReset();
		createMock.mockReset();
		broadcastRealtimeMock.mockReset();
		hashMock.mockReset();
		requireAdminMock.mockResolvedValue({
			session: { user: { id: 1, role: "admin" } },
		});
		hashMock.mockResolvedValue("hashed-password");
	});

	it("returns admin auth response when caller is not admin", async () => {
		requireAdminMock.mockResolvedValue({
			response: new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }),
		});

		const { POST } = await import("@/app/api/admin/users/route");
		const req = new Request("http://localhost/api/admin/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ nickname: "tester", password: "password1!" }),
		});

		const res = await POST(req);
		expect(res.status).toBe(403);
	});

	it("returns 400 when password policy is invalid", async () => {
		const { POST } = await import("@/app/api/admin/users/route");
		const req = new Request("http://localhost/api/admin/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ nickname: "tester", password: "short" }),
		});

		const res = await POST(req);
		await expect(res.json()).resolves.toEqual({ error: "invalid_password_policy" });
		expect(createMock).not.toHaveBeenCalled();
	});

	it("returns 400 when nickname already exists", async () => {
		findFirstMock.mockResolvedValue({ id: 88 });

		const { POST } = await import("@/app/api/admin/users/route");
		const req = new Request("http://localhost/api/admin/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ nickname: "tester", password: "password1!" }),
		});

		const res = await POST(req);
		await expect(res.json()).resolves.toEqual({ error: "nickname_already_exists" });
		expect(createMock).not.toHaveBeenCalled();
	});

	it("creates approved user with hashed password", async () => {
		findFirstMock.mockResolvedValue(null);
		createMock.mockResolvedValue({
			id: 55,
			email: "tester@crafter.local",
			nickname: "tester",
			role: "user",
			isApproved: 1,
			isBanned: 0,
			createdAt: new Date("2026-03-20T00:00:00.000Z"),
			lastAuthAt: null,
			deletedAt: null,
			signupNote: "관리자 생성",
			minecraftUuid: null,
		});

		const { POST } = await import("@/app/api/admin/users/route");
		const req = new Request("http://localhost/api/admin/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ nickname: "tester", password: "password1!", signupNote: "관리자 생성" }),
		});

		const res = await POST(req);
		expect(res.status).toBe(201);
		expect(hashMock).toHaveBeenCalledWith("password1!", 10);
		expect(createMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					email: "tester@crafter.local",
					nickname: "tester",
					password: "hashed-password",
					role: "user",
					isApproved: 1,
					isBanned: 0,
					emailVerified: 1,
					minecraftUuid: null,
					minecraftNickname: null,
				}),
			})
		);
		expect(broadcastRealtimeMock).toHaveBeenCalledWith(
			expect.objectContaining({
				payload: expect.objectContaining({
					userId: 55,
					action: "created",
				}),
			})
		);
	});
});
