import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
const notificationCountMock = vi.fn();
const notificationFindManyMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		notification: {
			count: notificationCountMock,
			findMany: notificationFindManyMock,
		},
	},
}));

describe("GET /api/notifications", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		notificationCountMock.mockReset();
		notificationFindManyMock.mockReset();
		authMock.mockResolvedValue({ user: { id: "7" } });
		notificationCountMock.mockResolvedValue(3);
		notificationFindManyMock.mockResolvedValue([
			{
				id: 101,
				type: "mention_comment",
				message: "alice님이 회원님을 멘션했음",
				postId: 12,
				commentId: 88,
				isRead: 0,
				createdAt: new Date("2026-03-07T00:00:00.000Z"),
				actor: {
					id: 9,
					nickname: "alice",
				},
			},
		]);
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);

		const { GET } = await import("@/app/api/notifications/route");
		const req = new NextRequest("http://localhost/api/notifications");
		const res = await GET(req);

		expect(res.status).toBe(401);
		expect(notificationCountMock).not.toHaveBeenCalled();
		expect(notificationFindManyMock).not.toHaveBeenCalled();
	});

	it("returns unread count when countOnly=1", async () => {
		const { GET } = await import("@/app/api/notifications/route");
		const req = new NextRequest("http://localhost/api/notifications?countOnly=1");
		const res = await GET(req);

		expect(res.status).toBe(200);
		expect(notificationCountMock).toHaveBeenCalledWith({
			where: {
				userId: 7,
				isRead: 0,
			},
		});
		expect(notificationFindManyMock).not.toHaveBeenCalled();
		await expect(res.json()).resolves.toEqual({ unreadCount: 3 });
	});

	it("returns latest notifications for current user only", async () => {
		const { GET } = await import("@/app/api/notifications/route");
		const req = new NextRequest("http://localhost/api/notifications");
		const res = await GET(req);
		const body = (await res.json()) as {
			notifications: Array<{ id: number; message: string; actor: { nickname: string } | null }>;
		};

		expect(res.status).toBe(200);
		expect(notificationFindManyMock).toHaveBeenCalledWith({
			where: {
				userId: 7,
			},
			orderBy: { createdAt: "desc" },
			take: 50,
			include: {
				actor: {
					select: {
						id: true,
						nickname: true,
					},
				},
			},
		});
		expect(body.notifications).toHaveLength(1);
		expect(body.notifications[0]).toMatchObject({
			id: 101,
			message: "alice님이 회원님을 멘션했음",
			actor: {
				nickname: "alice",
			},
		});
	});
});
