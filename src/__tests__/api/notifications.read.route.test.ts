import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const notificationUpdateManyMock = vi.fn();
const notificationCountMock = vi.fn();
const broadcastRealtimeMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		notification: {
			updateMany: notificationUpdateManyMock,
			count: notificationCountMock,
		},
	},
}));

vi.mock("@/lib/realtime/server-broadcast", () => ({
	broadcastRealtime: broadcastRealtimeMock,
}));

describe("PATCH /api/notifications/[id]/read", () => {
	beforeEach(() => {
		vi.resetModules();
		authMock.mockReset();
		notificationUpdateManyMock.mockReset();
		notificationCountMock.mockReset();
		broadcastRealtimeMock.mockReset();
		authMock.mockResolvedValue({ user: { id: "7" } });
		notificationUpdateManyMock.mockResolvedValue({ count: 1 });
		notificationCountMock.mockResolvedValue(2);
		broadcastRealtimeMock.mockResolvedValue(undefined);
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);

		const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
		const req = new Request("http://localhost/api/notifications/10/read", {
			method: "PATCH",
		});
		const res = await PATCH(req, { params: Promise.resolve({ id: "10" }) });

		expect(res.status).toBe(401);
		expect(notificationUpdateManyMock).not.toHaveBeenCalled();
		expect(broadcastRealtimeMock).not.toHaveBeenCalled();
	});

	it("returns 400 when notification id is invalid", async () => {
		const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
		const req = new Request("http://localhost/api/notifications/abc/read", {
			method: "PATCH",
		});
		const res = await PATCH(req, { params: Promise.resolve({ id: "abc" }) });

		expect(res.status).toBe(400);
		await expect(res.json()).resolves.toEqual({ error: "Invalid notification ID" });
		expect(notificationUpdateManyMock).not.toHaveBeenCalled();
		expect(broadcastRealtimeMock).not.toHaveBeenCalled();
	});

	it("marks notification as read and broadcasts unread count", async () => {
		const { PATCH } = await import("@/app/api/notifications/[id]/read/route");
		const req = new Request("http://localhost/api/notifications/10/read", {
			method: "PATCH",
		});
		const res = await PATCH(req, { params: Promise.resolve({ id: "10" }) });

		expect(res.status).toBe(200);
		expect(notificationUpdateManyMock).toHaveBeenCalledWith({
			where: {
				id: 10,
				userId: 7,
			},
			data: {
				isRead: 1,
			},
		});
		expect(notificationCountMock).toHaveBeenCalledWith({
			where: {
				userId: 7,
				isRead: 0,
			},
		});
		expect(broadcastRealtimeMock).toHaveBeenCalledWith({
			topic: "user:7",
			event: "notification.read.changed",
			payload: {
				notificationId: 10,
				unreadCount: 2,
			},
		});
		await expect(res.json()).resolves.toEqual({ success: true });
	});
});
