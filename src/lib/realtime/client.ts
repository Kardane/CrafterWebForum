"use client";

type RealtimePayload = Record<string, unknown>;
type RealtimeEventHandler = (payload: RealtimePayload) => void;
type TopicSubscriptions = Map<string, Set<RealtimeEventHandler>>;

interface RealtimeWebSocketClientOptions {
	wsUrl?: string;
	tokenEndpoint?: string;
	reconnectDelayMs?: number;
	fetchImpl?: typeof fetch;
	WebSocketImpl?: typeof WebSocket;
}

type BroadcastMessage = {
	type: "broadcast";
	topic: string;
	event: string;
	payload?: RealtimePayload;
};

const DEFAULT_TOKEN_ENDPOINT = "/api/realtime/token";
const DEFAULT_RECONNECT_DELAY_MS = 2_000;

function appendToken(url: string, token: string) {
	const separator = url.includes("?") ? "&" : "?";
	return `${url}${separator}token=${encodeURIComponent(token)}`;
}

function isBroadcastMessage(value: unknown): value is BroadcastMessage {
	if (!value || typeof value !== "object") {
		return false;
	}
	const message = value as Partial<BroadcastMessage>;
	return message.type === "broadcast" && typeof message.topic === "string" && typeof message.event === "string";
}

export class RealtimeWebSocketClient {
	private readonly wsUrl: string;
	private readonly tokenEndpoint: string;
	private readonly reconnectDelayMs: number;
	private readonly fetchImpl: typeof fetch;
	private readonly WebSocketImpl: typeof WebSocket;
	private readonly subscriptions = new Map<string, TopicSubscriptions>();
	private socket: WebSocket | null = null;
	private connectPromise: Promise<void> | null = null;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private shouldReconnect = true;

	constructor(options: RealtimeWebSocketClientOptions = {}) {
		this.wsUrl = options.wsUrl ?? process.env.NEXT_PUBLIC_REALTIME_WS_URL?.trim() ?? "";
		this.tokenEndpoint = options.tokenEndpoint ?? DEFAULT_TOKEN_ENDPOINT;
		this.reconnectDelayMs = options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.WebSocketImpl = options.WebSocketImpl ?? WebSocket;
	}

	subscribe(topic: string, event: string, handler: RealtimeEventHandler) {
		this.shouldReconnect = true;
		const topicSubscriptions = this.getOrCreateTopicSubscriptions(topic);
		const eventHandlers = topicSubscriptions.get(event) ?? new Set<RealtimeEventHandler>();
		eventHandlers.add(handler);
		topicSubscriptions.set(event, eventHandlers);

		void this.ensureConnected();
		this.sendIfOpen({ type: "subscribe", topic });

		return () => {
			this.removeHandler(topic, event, handler);
		};
	}

	disconnect() {
		this.shouldReconnect = false;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		const socket = this.socket;
		this.socket = null;
		socket?.close();
	}

	private getOrCreateTopicSubscriptions(topic: string) {
		const existing = this.subscriptions.get(topic);
		if (existing) {
			return existing;
		}
		const created = new Map<string, Set<RealtimeEventHandler>>();
		this.subscriptions.set(topic, created);
		return created;
	}

	private removeHandler(topic: string, event: string, handler: RealtimeEventHandler) {
		const topicSubscriptions = this.subscriptions.get(topic);
		const eventHandlers = topicSubscriptions?.get(event);
		if (!topicSubscriptions || !eventHandlers) {
			return;
		}

		eventHandlers.delete(handler);
		if (eventHandlers.size === 0) {
			topicSubscriptions.delete(event);
		}
		if (topicSubscriptions.size > 0) {
			return;
		}

		this.subscriptions.delete(topic);
		this.sendIfOpen({ type: "unsubscribe", topic });
		if (!this.hasSubscriptions()) {
			this.disconnect();
		}
	}

	private hasSubscriptions() {
		return this.subscriptions.size > 0;
	}

	private async ensureConnected() {
		if (!this.wsUrl || !this.hasSubscriptions()) {
			return;
		}
		if (
			this.socket &&
			(this.socket.readyState === this.WebSocketImpl.OPEN ||
				this.socket.readyState === this.WebSocketImpl.CONNECTING)
		) {
			return;
		}
		if (this.connectPromise) {
			return this.connectPromise;
		}

		this.connectPromise = this.openConnection();
		try {
			await this.connectPromise;
		} finally {
			this.connectPromise = null;
		}
	}

	private async openConnection() {
		const token = await this.fetchToken();
		if (!token || !this.hasSubscriptions()) {
			return;
		}

		const socket = new this.WebSocketImpl(appendToken(this.wsUrl, token));
		this.socket = socket;

		socket.onopen = () => {
			for (const topic of this.subscriptions.keys()) {
				this.sendIfOpen({ type: "subscribe", topic });
			}
		};
		socket.onmessage = (event) => {
			this.handleSocketMessage(event.data);
		};
		socket.onclose = () => {
			if (this.socket === socket) {
				this.socket = null;
			}
			if (this.shouldReconnect && this.hasSubscriptions()) {
				this.scheduleReconnect();
			}
		};
		socket.onerror = () => {
			socket.close();
		};
	}

	private async fetchToken() {
		try {
			const response = await this.fetchImpl(this.tokenEndpoint, {
				method: "GET",
				credentials: "same-origin",
				cache: "no-store",
			});
			if (!response.ok) {
				return null;
			}
			const body = (await response.json()) as { token?: unknown };
			return typeof body.token === "string" && body.token ? body.token : null;
		} catch (error) {
			console.error("[realtime] token request failed:", error);
			return null;
		}
	}

	private handleSocketMessage(rawData: unknown) {
		try {
			const parsed = typeof rawData === "string" ? JSON.parse(rawData) : rawData;
			if (!isBroadcastMessage(parsed)) {
				return;
			}
			const eventHandlers = this.subscriptions.get(parsed.topic)?.get(parsed.event);
			if (!eventHandlers) {
				return;
			}
			const payload = parsed.payload ?? {};
			for (const handler of eventHandlers) {
				handler(payload);
			}
		} catch (error) {
			console.error("[realtime] invalid message:", error);
		}
	}

	private scheduleReconnect() {
		if (this.reconnectTimer) {
			return;
		}
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			void this.ensureConnected();
		}, this.reconnectDelayMs);
	}

	private sendIfOpen(message: { type: "subscribe" | "unsubscribe" | "ping"; topic?: string }) {
		if (!this.socket || this.socket.readyState !== this.WebSocketImpl.OPEN) {
			return;
		}
		this.socket.send(JSON.stringify(message));
	}
}

let client: RealtimeWebSocketClient | null = null;

export function getRealtimeClient() {
	const wsUrl = process.env.NEXT_PUBLIC_REALTIME_WS_URL?.trim();
	if (!wsUrl || typeof WebSocket === "undefined") {
		return null;
	}
	if (!client) {
		client = new RealtimeWebSocketClient({ wsUrl });
	}
	return client;
}
