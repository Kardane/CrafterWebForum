import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const getUserProfileMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/user-service", () => ({
	getUserProfile: getUserProfileMock,
}));

describe("GET /api/auth/profile", () => {
	beforeEach(() => {
		authMock.mockReset();
		getUserProfileMock.mockReset();
	});

	it("returns deprecation headers and profile payload", async () => {
		authMock.mockResolvedValue({ user: { id: 10 } });
		getUserProfileMock.mockResolvedValue({
			user: {
				id: 10,
				email: "foo@example.com",
				nickname: "foo",
				minecraftUuid: null,
				role: "user",
				createdAt: new Date("2026-01-01T00:00:00.000Z"),
				lastAuthAt: null,
			},
			stats: { posts: 1, comments: 2 },
			last_auth_at: null,
		});

		const { GET } = await import("@/app/api/auth/profile/route");
		const res = await GET();
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.stats).toEqual({ posts: 1, comments: 2 });
		expect(res.headers.get("Deprecation")).toBe("true");
		expect(res.headers.get("Link")).toContain("/api/users/me");
	});
});
