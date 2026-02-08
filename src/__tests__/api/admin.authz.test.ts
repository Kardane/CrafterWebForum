import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

describe("admin authorization", () => {
	beforeEach(() => {
		authMock.mockReset();
	});

	it("returns 401 when admin API is called without session", async () => {
		authMock.mockResolvedValue(null);
		const { requireAdmin } = await import("@/lib/admin-auth");
		const result = await requireAdmin();
		expect("response" in result).toBe(true);
		if ("response" in result) expect(result.response.status).toBe(401);
	});

	it("returns 403 when role is not admin", async () => {
		authMock.mockResolvedValue({
			user: { id: 1, role: "user", nickname: "u", isApproved: 1 },
		});
		const { requireAdmin } = await import("@/lib/admin-auth");
		const result = await requireAdmin();
		expect("response" in result).toBe(true);
		if ("response" in result) expect(result.response.status).toBe(403);
	});

	it("allows privileged nickname even when role is user", async () => {
		authMock.mockResolvedValue({
			user: { id: 1, role: "user", nickname: "Karned", isApproved: 1 },
		});
		const { requireAdmin } = await import("@/lib/admin-auth");
		const result = await requireAdmin();
		expect("session" in result).toBe(true);
	});
});
