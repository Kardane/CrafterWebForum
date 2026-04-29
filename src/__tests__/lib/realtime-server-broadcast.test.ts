import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("broadcastRealtime", () => {
	const originalFetch = globalThis.fetch;
	const fetchMock = vi.fn();

	beforeEach(() => {
		vi.resetModules();
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
		delete process.env.REALTIME_BROADCAST_URL;
		delete process.env.REALTIME_SERVER_SECRET;
	});

	afterEach(() => {
		vi.stubGlobal("fetch", originalFetch);
	});

	it("환경변수가 없으면 아무 요청도 보내지 않는다", async () => {
		const { broadcastRealtime } = await import("@/lib/realtime/server-broadcast");

		await broadcastRealtime({
			topic: "post:1",
			event: "comment.created",
			payload: { id: 10 },
		});

		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("OCI broadcast endpoint로 Bearer 인증과 메시지를 전송한다", async () => {
		process.env.REALTIME_BROADCAST_URL = "https://realtime.stevegallery.kr/broadcast";
		process.env.REALTIME_SERVER_SECRET = "server-secret";
		fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
		const { broadcastRealtime } = await import("@/lib/realtime/server-broadcast");

		await broadcastRealtime({
			topic: "user:7",
			event: "notification.created",
			payload: { unreadCount: 3 },
		});

		expect(fetchMock).toHaveBeenCalledWith("https://realtime.stevegallery.kr/broadcast", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer server-secret",
			},
			body: JSON.stringify({
				topic: "user:7",
				event: "notification.created",
				payload: { unreadCount: 3 },
			}),
			cache: "no-store",
		});
	});

	it("fetch가 실패해도 호출부로 예외를 던지지 않는다", async () => {
		process.env.REALTIME_BROADCAST_URL = "https://realtime.stevegallery.kr/broadcast";
		process.env.REALTIME_SERVER_SECRET = "server-secret";
		fetchMock.mockRejectedValue(new Error("network down"));
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { broadcastRealtime } = await import("@/lib/realtime/server-broadcast");

		await expect(
			broadcastRealtime({
				topic: "post:1",
				event: "comment.created",
				payload: {},
			})
		).resolves.toBeUndefined();

		consoleErrorSpy.mockRestore();
	});
});
