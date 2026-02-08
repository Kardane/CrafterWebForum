import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const deleteManyMock = vi.fn();
const findUniqueMock = vi.fn();
const createMock = vi.fn();
const findFirstMock = vi.fn();
const deleteMock = vi.fn();
const userUpdateMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		minecraftCode: {
			deleteMany: deleteManyMock,
			findUnique: findUniqueMock,
			create: createMock,
			findFirst: findFirstMock,
			delete: deleteMock,
		},
		user: {
			update: userUpdateMock,
		},
	},
}));

describe("users/me minecraft reauth route", () => {
	beforeEach(() => {
		authMock.mockReset();
		deleteManyMock.mockReset();
		findUniqueMock.mockReset();
		createMock.mockReset();
		findFirstMock.mockReset();
		deleteMock.mockReset();
		userUpdateMock.mockReset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("POST returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);

		const { POST } = await import("@/app/api/users/me/minecraft-reauth/route");
		const req = new Request("http://localhost/api/users/me/minecraft-reauth", { method: "POST" });
		const res = await POST(req as never);

		expect(res.status).toBe(401);
	});

	it("POST stores a user-scoped code in DB", async () => {
		authMock.mockResolvedValue({ user: { id: 42 } });
		deleteManyMock.mockResolvedValue({ count: 0 });
		findUniqueMock.mockResolvedValue(null);
		createMock.mockResolvedValue({ code: "211110" });
		vi.spyOn(Math, "random").mockReturnValue(0.123456);

		const { POST } = await import("@/app/api/users/me/minecraft-reauth/route");
		const req = new Request("http://localhost/api/users/me/minecraft-reauth", { method: "POST" });
		const res = await POST(req as never);
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.success).toBe(true);
		expect(body.expiresIn).toBe(300);
		expect(createMock).toHaveBeenCalledWith({
			data: {
				code: body.code,
				userId: 42,
				ipAddress: "reauth:42",
				isVerified: 0,
			},
		});
	});

	it("GET updates profile and returns verified response", async () => {
		authMock.mockResolvedValue({ user: { id: 42 } });
		findFirstMock.mockResolvedValue({
			code: "123456",
			createdAt: new Date(Date.now() - 1000),
			isVerified: 1,
			linkedNickname: "verified_nick",
			linkedUuid: "verified-uuid",
		});
		userUpdateMock.mockResolvedValue({});
		deleteMock.mockResolvedValue({});

		const { GET } = await import("@/app/api/users/me/minecraft-reauth/route");
		const req = new Request("http://localhost/api/users/me/minecraft-reauth");
		const res = await GET(req as never);
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.verified).toBe(true);
		expect(body.nickname).toBe("verified_nick");
		expect(userUpdateMock).toHaveBeenCalledWith({
			where: { id: 42 },
			data: {
				nickname: "verified_nick",
				minecraftNickname: "verified_nick",
				minecraftUuid: "verified-uuid",
				lastAuthAt: expect.any(Date),
			},
		});
		expect(deleteMock).toHaveBeenCalledWith({ where: { code: "123456" } });
	});
});
