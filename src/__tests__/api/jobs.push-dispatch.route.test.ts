import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const findManyMock = vi.fn();
const updateManyMock = vi.fn();
const updateMock = vi.fn();
const transactionMock = vi.fn();

const ensureWebPushConfiguredMock = vi.fn();
const sendWebPushMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
	prisma: {
		notificationDelivery: {
			findMany: findManyMock,
			updateMany: updateManyMock,
			update: updateMock,
		},
		pushSubscription: {
			update: vi.fn(),
		},
		$transaction: transactionMock,
	},
}));

vi.mock("@/lib/push", () => ({
	buildDeliveryDedupeKey: vi.fn(() => "dedupe"),
	ensureWebPushConfigured: ensureWebPushConfiguredMock,
	getNotificationTargetUrl: vi.fn(() => "/notifications"),
	getRetryDelayMs: vi.fn(() => 60_000),
	sendWebPush: sendWebPushMock,
}));

describe("POST /api/jobs/push-dispatch", () => {
	beforeEach(() => {
		findManyMock.mockReset();
		updateManyMock.mockReset();
		updateMock.mockReset();
		transactionMock.mockReset();
		ensureWebPushConfiguredMock.mockReset();
		sendWebPushMock.mockReset();
		process.env.CRON_SECRET = "secret";
		updateManyMock.mockResolvedValue({ count: 1 });
		updateMock.mockResolvedValue({});
		transactionMock.mockResolvedValue([]);
	});

	it("returns 401 without cron authorization", async () => {
		const { POST } = await import("@/app/api/jobs/push-dispatch/route");
		const req = new NextRequest("http://localhost/api/jobs/push-dispatch", { method: "POST" });
		const res = await POST(req);
		expect(res.status).toBe(401);
	});

	it("returns 500 when VAPID config missing", async () => {
		ensureWebPushConfiguredMock.mockImplementation(() => {
			throw new Error("push_env_not_configured");
		});
		const { POST } = await import("@/app/api/jobs/push-dispatch/route");
		const req = new NextRequest("http://localhost/api/jobs/push-dispatch", {
			method: "POST",
			headers: { authorization: "Bearer secret" },
		});
		const res = await POST(req);
		expect(res.status).toBe(500);
	});

	it("processes queued delivery and marks sent", async () => {
		ensureWebPushConfiguredMock.mockReturnValue({});
		findManyMock.mockResolvedValue([
			{
				id: 1,
				notificationId: 10,
				subscriptionId: 100,
				channel: "web_push",
				attemptCount: 0,
				notification: { id: 10, type: "mention_comment", postId: 3, commentId: 4 },
				subscription: {
					id: 100,
					endpoint: "https://example.com",
					p256dh: "p",
					auth: "a",
					isActive: 1,
				},
			},
		]);
		sendWebPushMock.mockResolvedValue({ ok: true });

		const { POST } = await import("@/app/api/jobs/push-dispatch/route");
		const req = new NextRequest("http://localhost/api/jobs/push-dispatch", {
			method: "POST",
			headers: { authorization: "Bearer secret" },
		});
		const res = await POST(req);
		expect(res.status).toBe(200);
		expect(sendWebPushMock).toHaveBeenCalledTimes(1);
		expect(updateMock).toHaveBeenCalled();
	});

	it("returns 503 when NotificationDelivery table is missing", async () => {
		ensureWebPushConfiguredMock.mockReturnValue({});
		findManyMock.mockRejectedValue(new Error("SQLITE_UNKNOWN: SQLite error: no such table: main.NotificationDelivery"));

		const { POST } = await import("@/app/api/jobs/push-dispatch/route");
		const req = new NextRequest("http://localhost/api/jobs/push-dispatch", {
			method: "POST",
			headers: { authorization: "Bearer secret" },
		});
		const res = await POST(req);

		expect(res.status).toBe(503);
		await expect(res.json()).resolves.toEqual({ error: "db_schema_not_ready" });
	});
});
