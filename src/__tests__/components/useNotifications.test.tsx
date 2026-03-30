import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { REALTIME_EVENTS } from "@/lib/realtime/constants";

const mockState = vi.hoisted(() => ({
	sessionData: { user: { id: "7" } } as { user: { id: string } } | null,
	topic: null as string | null,
	handlers: {} as Record<string, (payload: Record<string, unknown>) => void>,
}));

type IdleTask = IdleRequestCallback;

vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data: mockState.sessionData,
	}),
}));

vi.mock("@/lib/realtime/useRealtimeBroadcast", () => ({
	useRealtimeBroadcast: (topic: string | null, handlers: Record<string, (payload: Record<string, unknown>) => void>) => {
		mockState.topic = topic;
		mockState.handlers = handlers;
	},
}));

function installPushSupport() {
	const subscribeMock = vi.fn().mockResolvedValue({
		endpoint: "https://push.example.com/subscriptions/1",
		keys: {
			p256dh: "p256dh-key",
			auth: "auth-key",
		},
	});
	const getSubscriptionMock = vi.fn().mockResolvedValue(null);
	const registerMock = vi.fn().mockResolvedValue({
		pushManager: {
			getSubscription: getSubscriptionMock,
			subscribe: subscribeMock,
		},
	});

	Object.defineProperty(window.navigator, "serviceWorker", {
		configurable: true,
		value: {
			register: registerMock,
		},
	});
	Object.defineProperty(window, "PushManager", {
		configurable: true,
		value: function PushManager() {},
	});

	return {
		registerMock,
		getSubscriptionMock,
		subscribeMock,
	};
}

function installNotificationMock(permission: NotificationPermission = "granted") {
	const createdMock = vi.fn();
	class NotificationMock {
		static permission: NotificationPermission = permission;
		static requestPermission = vi.fn().mockResolvedValue(permission);
		onclick: (() => void) | null = null;

		constructor(title: string, options?: NotificationOptions) {
			createdMock(title, options);
		}

		close() {}
	}

	vi.stubGlobal("Notification", NotificationMock as unknown as typeof Notification);

	return {
		createdMock,
		requestPermissionMock: NotificationMock.requestPermission,
	};
}

function installIdleSupport() {
	const callbacks: IdleTask[] = [];
	const requestIdleCallbackMock = vi.fn((callback: IdleTask) => {
		callbacks.push(callback);
		return callbacks.length;
	});
	const cancelIdleCallbackMock = vi.fn((handle: number) => {
		callbacks.splice(handle - 1, 1);
	});

	vi.stubGlobal("requestIdleCallback", requestIdleCallbackMock);
	vi.stubGlobal("cancelIdleCallback", cancelIdleCallbackMock);

	const flushNextIdleTask = async () => {
		const callback = callbacks.shift();
		if (!callback) {
			return;
		}
		await act(async () => {
			callback({
				didTimeout: false,
				timeRemaining: () => 50,
			} as IdleDeadline);
			await Promise.resolve();
		});
	};

	return {
		requestIdleCallbackMock,
		cancelIdleCallbackMock,
		flushNextIdleTask,
	};
}

async function renderProbe() {
	const { useNotifications } = await import("@/components/notifications/useNotifications");

	function Probe() {
		const { unreadCount } = useNotifications();
		return <div data-testid="unread-count">{unreadCount}</div>;
	}

	return render(<Probe />);
}

describe("useNotifications", () => {
	beforeEach(() => {
		vi.resetModules();
		mockState.sessionData = { user: { id: "7" } };
		mockState.topic = null;
		mockState.handlers = {};
		Object.defineProperty(window.navigator, "serviceWorker", { configurable: true, value: undefined });
		Object.defineProperty(window, "PushManager", { configurable: true, value: undefined });
		Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
		vi.spyOn(document, "hasFocus").mockReturnValue(true);
		delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("loads unread count and subscribes browser push on mount when supported", async () => {
		process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "AQAB";
		const { requestIdleCallbackMock, flushNextIdleTask } = installIdleSupport();
		const { registerMock, subscribeMock } = installPushSupport();
		installNotificationMock("granted");

		const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
			const url = String(input);
			if (url === "/api/notifications?countOnly=1") {
				return new Response(JSON.stringify({ unreadCount: 2 }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			if (url === "/api/push/subscribe") {
				return new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			throw new Error(`unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		await renderProbe();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(requestIdleCallbackMock).toHaveBeenCalledTimes(1);

		await flushNextIdleTask();

		await waitFor(() => {
			expect(screen.getByTestId("unread-count").textContent).toBe("2");
		});
		expect(registerMock).not.toHaveBeenCalled();

		await flushNextIdleTask();

		await waitFor(() => {
			expect(registerMock).toHaveBeenCalledWith("/sw.js");
			expect(subscribeMock).toHaveBeenCalledTimes(1);
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/push/subscribe",
				expect.objectContaining({
					method: "POST",
					headers: { "Content-Type": "application/json" },
				})
			);
		});
		expect(mockState.topic).toBe("user:7");
	});

	it("shows browser notification only for mention_comment when hidden and refreshes unread count", async () => {
		const { flushNextIdleTask } = installIdleSupport();
		const { createdMock } = installNotificationMock("granted");
		Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
		vi.spyOn(document, "hasFocus").mockReturnValue(false);

		let unreadCount = 1;
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === "/api/notifications?countOnly=1") {
				return new Response(JSON.stringify({ unreadCount }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			throw new Error(`unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		await renderProbe();
		expect(fetchMock).not.toHaveBeenCalled();

		Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
		document.dispatchEvent(new Event("visibilitychange"));
		await flushNextIdleTask();

		await waitFor(() => {
			expect(screen.getByTestId("unread-count").textContent).toBe("1");
		});

		unreadCount = 4;
		await act(async () => {
			mockState.handlers[REALTIME_EVENTS.NOTIFICATION_CREATED]?.({
				type: "mention_comment",
				actorNickname: "alice",
				postId: 12,
				commentId: 34,
			});
		});

		await waitFor(() => {
			expect(screen.getByTestId("unread-count").textContent).toBe("4");
			expect(createdMock).toHaveBeenCalledWith(
				"새 멘션 알림",
				expect.objectContaining({
					body: "alice님이 회원님을 멘션했음",
					tag: "mention-12-34",
				})
			);
		});
	});

	it("does not show browser notification while page is visible and focused", async () => {
		const { flushNextIdleTask } = installIdleSupport();
		const { createdMock } = installNotificationMock("granted");

		let unreadCount = 1;
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === "/api/notifications?countOnly=1") {
				return new Response(JSON.stringify({ unreadCount }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			throw new Error(`unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		await renderProbe();
		await flushNextIdleTask();

		await waitFor(() => {
			expect(screen.getByTestId("unread-count").textContent).toBe("1");
		});

		unreadCount = 2;
		await act(async () => {
			mockState.handlers[REALTIME_EVENTS.NOTIFICATION_CREATED]?.({
				type: "mention_comment",
				actorNickname: "alice",
				postId: 12,
				commentId: 36,
			});
		});

		await waitFor(() => {
			expect(screen.getByTestId("unread-count").textContent).toBe("2");
		});
		expect(createdMock).not.toHaveBeenCalled();
	});

	it("does not show browser notification for post_comment and applies direct unread count updates", async () => {
		const { flushNextIdleTask } = installIdleSupport();
		const { createdMock } = installNotificationMock("granted");
		Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
		vi.spyOn(document, "hasFocus").mockReturnValue(false);

		let unreadCount = 1;
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url === "/api/notifications?countOnly=1") {
				return new Response(JSON.stringify({ unreadCount }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				});
			}
			throw new Error(`unexpected fetch: ${url}`);
		});
		vi.stubGlobal("fetch", fetchMock);

		await renderProbe();
		Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
		document.dispatchEvent(new Event("visibilitychange"));
		await flushNextIdleTask();

		await waitFor(() => {
			expect(screen.getByTestId("unread-count").textContent).toBe("1");
		});

		unreadCount = 5;
		await act(async () => {
			mockState.handlers[REALTIME_EVENTS.NOTIFICATION_CREATED]?.({
				type: "post_comment",
				actorNickname: "alice",
				postId: 12,
				commentId: 35,
			});
		});

		await waitFor(() => {
			expect(screen.getByTestId("unread-count").textContent).toBe("5");
		});
		expect(createdMock).not.toHaveBeenCalled();

		await act(async () => {
			mockState.handlers[REALTIME_EVENTS.NOTIFICATION_READ_CHANGED]?.({
				unreadCount: 0,
			});
		});

		await waitFor(() => {
			expect(screen.getByTestId("unread-count").textContent).toBe("0");
		});
	});
});
