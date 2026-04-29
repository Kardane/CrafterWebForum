import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class MockWebSocket {
	static CONNECTING = 0;
	static OPEN = 1;
	static CLOSED = 3;
	static instances: MockWebSocket[] = [];

	readyState = MockWebSocket.CONNECTING;
	sent: string[] = [];
	onopen: ((event: Event) => void) | null = null;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onclose: ((event: CloseEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;

	constructor(public readonly url: string) {
		MockWebSocket.instances.push(this);
	}

	send(data: string) {
		this.sent.push(data);
	}

	close() {
		this.readyState = MockWebSocket.CLOSED;
		this.onclose?.(new CloseEvent("close"));
	}

	open() {
		this.readyState = MockWebSocket.OPEN;
		this.onopen?.(new Event("open"));
	}

	emitMessage(message: unknown) {
		this.onmessage?.(
			new MessageEvent("message", {
				data: JSON.stringify(message),
			})
		);
	}
}

async function flushPromises() {
	for (let index = 0; index < 5; index += 1) {
		await Promise.resolve();
	}
}

describe("RealtimeWebSocketClient", () => {
	const originalFetch = globalThis.fetch;
	const originalWebSocket = globalThis.WebSocket;
	const fetchMock = vi.fn();

	beforeEach(() => {
		vi.resetModules();
		fetchMock.mockReset();
		MockWebSocket.instances = [];
		process.env.NEXT_PUBLIC_REALTIME_WS_URL = "wss://realtime.stevegallery.kr/ws";
		fetchMock.mockImplementation(() =>
			Promise.resolve(new Response(JSON.stringify({ token: "client-token" }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}))
		);
		vi.stubGlobal("fetch", fetchMock);
		vi.stubGlobal("WebSocket", MockWebSocket);
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.stubGlobal("fetch", originalFetch);
		vi.stubGlobal("WebSocket", originalWebSocket);
		delete process.env.NEXT_PUBLIC_REALTIME_WS_URL;
	});

	it("토큰을 요청하고 topic 구독 뒤 broadcast handler를 호출한다", async () => {
		const { RealtimeWebSocketClient } = await import("@/lib/realtime/client");
		const handler = vi.fn();
		const client = new RealtimeWebSocketClient({
			wsUrl: "wss://realtime.stevegallery.kr/ws",
			reconnectDelayMs: 5,
			fetchImpl: fetchMock as unknown as typeof fetch,
			WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
		});

		const unsubscribe = client.subscribe("post:1", "comment.created", handler);
		await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
		const socket = MockWebSocket.instances[0];
		socket.open();
		socket.emitMessage({
			type: "broadcast",
			topic: "post:1",
			event: "comment.created",
			payload: { id: 10 },
		});
		unsubscribe();

		expect(fetchMock).toHaveBeenCalledWith("/api/realtime/token", {
			method: "GET",
			credentials: "same-origin",
			cache: "no-store",
		});
		expect(socket.url).toBe("wss://realtime.stevegallery.kr/ws?token=client-token");
		expect(socket.sent).toContain(JSON.stringify({ type: "subscribe", topic: "post:1" }));
		expect(handler).toHaveBeenCalledWith({ id: 10 });
		expect(socket.sent).toContain(JSON.stringify({ type: "unsubscribe", topic: "post:1" }));
		client.disconnect();
	});

	it("연결이 닫히면 기존 topic을 다시 구독한다", async () => {
		const { RealtimeWebSocketClient } = await import("@/lib/realtime/client");
		const client = new RealtimeWebSocketClient({
			wsUrl: "wss://realtime.stevegallery.kr/ws",
			reconnectDelayMs: 0,
			fetchImpl: fetchMock as unknown as typeof fetch,
			WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
		});

		client.subscribe("user:7", "notification.created", vi.fn());
		await waitFor(() => expect(MockWebSocket.instances).toHaveLength(1));
		const firstSocket = MockWebSocket.instances[0];
		firstSocket.open();
		firstSocket.sent = [];

		firstSocket.close();
		await flushPromises();
		await waitFor(() => expect(MockWebSocket.instances).toHaveLength(2));
		const secondSocket = MockWebSocket.instances[1];
		secondSocket.open();

		expect(MockWebSocket.instances).toHaveLength(2);
		expect(secondSocket.sent).toContain(JSON.stringify({ type: "subscribe", topic: "user:7" }));
		client.disconnect();
	});
});
