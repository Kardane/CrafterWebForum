import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const resolveActiveUserFromSessionMock = vi.fn();
const listSidebarTrackedPostsMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/active-user", () => ({
	resolveActiveUserFromSession: resolveActiveUserFromSessionMock,
}));

vi.mock("@/lib/services/sidebar-tracked-posts-service", () => ({
	listSidebarTrackedPosts: listSidebarTrackedPostsMock,
}));

describe("GET /api/sidebar/tracked-posts", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		resolveActiveUserFromSessionMock.mockReset();
		listSidebarTrackedPostsMock.mockReset();
	});

	it("returns active user error when unauthorized", async () => {
		authMock.mockResolvedValue(null);
		resolveActiveUserFromSessionMock.mockResolvedValue({ ok: false, status: 401, error: "unauthorized" });

		const { GET } = await import("@/app/api/sidebar/tracked-posts/route");
		const req = new Request("http://localhost/api/sidebar/tracked-posts");
		const res = await GET(req as never);

		expect(res.status).toBe(401);
		await expect(res.json()).resolves.toEqual({ error: "unauthorized" });
		expect(listSidebarTrackedPostsMock).not.toHaveBeenCalled();
	});

	it("returns tracked posts payload", async () => {
		authMock.mockResolvedValue({ user: { id: "12" } });
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: true,
			context: { userId: 12, role: "user", nickname: "n", isApproved: 1, isBanned: 0 },
		});
		listSidebarTrackedPostsMock.mockResolvedValue({
			items: [
				{
					postId: 22,
					title: "tracked",
					href: "/posts/22",
					lastActivityAt: "2026-03-05T00:00:00.000Z",
					author: { nickname: "author", minecraftUuid: null },
					sourceFlags: { authored: true, subscribed: false },
					isSubscribed: false,
					commentCount: 7,
					newCommentCount: 3,
					latestCommentId: 501,
				},
			],
			page: {
				limit: 30,
				nextCursor: "123_22",
				hasMore: true,
			},
		});

		const { GET } = await import("@/app/api/sidebar/tracked-posts/route");
		const req = new Request("http://localhost/api/sidebar/tracked-posts?cursor=10_1&limit=20");
		const res = await GET(req as never);
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(listSidebarTrackedPostsMock).toHaveBeenCalledWith({ userId: 12, cursor: "10_1", limit: 20 });
		expect(body.page).toEqual({ limit: 30, nextCursor: "123_22", hasMore: true });
		expect(body.items).toHaveLength(1);
	});
});
