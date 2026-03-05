import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const resolveActiveUserFromSessionMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/active-user", () => ({
	resolveActiveUserFromSession: resolveActiveUserFromSessionMock,
}));

describe("admin authorization", () => {
	beforeEach(() => {
		authMock.mockReset();
		resolveActiveUserFromSessionMock.mockReset();
	});

	it("returns 401 when admin API is called without session", async () => {
		authMock.mockResolvedValue(null);
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: false,
			status: 401,
			error: "unauthorized",
		});
		const { requireAdmin } = await import("@/lib/admin-auth");
		const result = await requireAdmin();
		expect("response" in result).toBe(true);
		if ("response" in result) expect(result.response.status).toBe(401);
	});

	it("returns 403 when role is not admin", async () => {
		authMock.mockResolvedValue({
			user: { id: 1, role: "user", nickname: "u", isApproved: 1 },
		});
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: false,
			status: 403,
			error: "forbidden",
		});
		const { requireAdmin } = await import("@/lib/admin-auth");
		const result = await requireAdmin();
		expect("response" in result).toBe(true);
		if ("response" in result) expect(result.response.status).toBe(403);
	});

	it("allows admin role", async () => {
		authMock.mockResolvedValue({
			user: { id: 1, role: "admin", nickname: "u", isApproved: 1 },
		});
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: true,
			user: { id: 1, role: "admin", nickname: "u", isApproved: 1, isBanned: 0 },
			sessionUser: { id: 1, role: "admin", nickname: "u", isApproved: 1, isBanned: 0 },
		});
		const { requireAdmin } = await import("@/lib/admin-auth");
		const result = await requireAdmin();
		expect("session" in result).toBe(true);
	});
});
