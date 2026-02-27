import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getUserProfileMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/user-service", () => ({
	getUserProfile: getUserProfileMock,
}));

describe("GET /api/users/me", () => {
	beforeEach(() => {
		authMock.mockReset();
		getUserProfileMock.mockReset();
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);

		const { GET } = await import("@/app/api/users/me/route");
		const req = new Request("http://localhost/api/users/me");
		const res = await GET(req as never);

		expect(res.status).toBe(401);
	});

	it("returns profile with likesReceived in stats", async () => {
		authMock.mockResolvedValue({ user: { id: "3" } });
		getUserProfileMock.mockResolvedValue({
			user: {
				id: 3,
				email: "test@example.com",
				nickname: "tester",
				minecraftUuid: null,
				role: "user",
				createdAt: new Date("2026-02-01T00:00:00Z"),
				lastAuthAt: null,
			},
			stats: {
				posts: 2,
				comments: 4,
				likesReceived: 11,
			},
			last_auth_at: null,
		});

		const { GET } = await import("@/app/api/users/me/route");
		const req = new Request("http://localhost/api/users/me");
		const res = await GET(req as never);
		const body = (await res.json()) as { stats: { likesReceived: number } };

		expect(res.status).toBe(200);
		expect(body.stats.likesReceived).toBe(11);
	});
});
