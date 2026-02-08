import { describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn().mockResolvedValue({
	session: {
		user: {
			id: 1,
			role: "admin",
			nickname: "Karned",
		},
	},
});

vi.mock("@/lib/admin-auth", () => ({
	requireAdmin: requireAdminMock,
}));

describe("admin stats and inquiries routes", () => {
	it("GET /api/admin/stats returns 200 for admin session", async () => {
		const { GET } = await import("@/app/api/admin/stats/route");
		const response = await GET(
			new Request("http://localhost:3000/api/admin/stats?range=14d")
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toHaveProperty("stats");
	});

	it("GET /api/admin/inquiries returns 200 for admin session", async () => {
		const { GET } = await import("@/app/api/admin/inquiries/route");
		const response = await GET(
			new Request("http://localhost:3000/api/admin/inquiries")
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toHaveProperty("inquiries");
	});
});
