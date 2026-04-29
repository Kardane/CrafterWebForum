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
const userCountMock = vi.fn();
const postCountMock = vi.fn();
const commentCountMock = vi.fn();
const queryRawMock = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
	requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		user: { count: userCountMock },
		post: { count: postCountMock },
		comment: { count: commentCountMock },
		$queryRaw: queryRawMock,
	},
}));

describe("admin stats route", () => {
	it("GET /api/admin/stats returns 200 for admin session", async () => {
		userCountMock.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
		postCountMock.mockResolvedValue(3);
		commentCountMock.mockResolvedValue(4);
		queryRawMock.mockResolvedValue([]);

		const { GET } = await import("@/app/api/admin/stats/route");
		const response = await GET(
			new Request("http://localhost:3000/api/admin/stats?range=14d")
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toHaveProperty("stats");
	});
});
