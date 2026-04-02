"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRealtimeBroadcast } from "@/lib/realtime/useRealtimeBroadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";
import { scheduleIdleTask } from "@/lib/idle-task";

function base64UrlToArrayBuffer(base64Url: string): ArrayBuffer {
	const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
	const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
	const raw = atob(base64);
	const buffer = new ArrayBuffer(raw.length);
	const output = new Uint8Array(buffer);
	for (let index = 0; index < raw.length; index += 1) {
		output[index] = raw.charCodeAt(index);
	}
	return buffer;
}

export function useNotifications() {
	const { data: session } = useSession();
	const sessionUserId = Number(session?.user?.id ?? 0);
	const [unreadCount, setUnreadCount] = useState(0);

	const ensurePushSubscription = useCallback(async () => {
		if (!sessionUserId || typeof window === "undefined") {
			return;
		}
		if (!navigator.serviceWorker || !window.PushManager || !window.Notification) {
			return;
		}
		const vapidPublicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
		if (!vapidPublicKey) {
			return;
		}

		try {
			const registration = await navigator.serviceWorker.register("/sw.js");
			let permission = Notification.permission;
			if (permission === "default") {
				permission = await Notification.requestPermission();
			}
			if (permission !== "granted") {
				return;
			}

			const existingSubscription = await registration.pushManager.getSubscription();
			const subscription =
				existingSubscription ??
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: base64UrlToArrayBuffer(vapidPublicKey),
				}));

			await fetch("/api/push/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(subscription),
			});
		} catch (error) {
			console.error("Push subscription setup failed:", error);
		}
	}, [sessionUserId]);

	const refreshUnreadCount = useCallback(async () => {
		if (!sessionUserId) {
			setUnreadCount(0);
			return;
		}
		try {
			const response = await fetch("/api/notifications?countOnly=1", { cache: "no-store" });
			if (!response.ok) {
				return;
			}
			const data = (await response.json()) as { unreadCount?: number };
			setUnreadCount(Number(data.unreadCount ?? 0));
		} catch {
			return;
		}
	}, [sessionUserId]);

	const showMentionBrowserNotification = useCallback((payload: Record<string, unknown>) => {
		if (typeof window === "undefined" || !("Notification" in window)) {
			return;
		}

		if (document.visibilityState === "visible" && document.hasFocus()) {
			return;
		}

		const type = String(payload.type ?? "");
		if (type !== "mention_comment") {
			return;
		}

		const actorNickname = String(payload.actorNickname ?? "누군가");
		const postId = Number(payload.postId ?? 0);
		const commentId = Number(payload.commentId ?? 0);
		const targetUrl =
			postId > 0
				? `/posts/${postId}${commentId > 0 ? `#comment-${commentId}` : ""}`
				: "/notifications";

		const openTarget = () => {
			window.focus();
			window.location.assign(targetUrl);
		};

		const createNotification = () => {
			const notification = new Notification("새 멘션 알림", {
				body: `${actorNickname}님이 회원님을 멘션했음`,
				icon: "/favicon-32.png",
				tag: `mention-${postId}-${commentId}`,
			});
			notification.onclick = () => {
				notification.close();
				openTarget();
			};
		};

		if (Notification.permission === "granted") {
			createNotification();
			return;
		}

		if (Notification.permission === "default") {
			void Notification.requestPermission().then((permission) => {
				if (permission === "granted") {
					createNotification();
				}
			});
		}
	}, []);

	useEffect(() => {
		if (!sessionUserId) {
			setUnreadCount(0);
			return;
		}

		let cancelled = false;
		let cancelUnreadBootstrap: () => void = () => {};
		let cancelPushBootstrap: () => void = () => {};

		const bootstrap = () => {
			cancelUnreadBootstrap = scheduleIdleTask(() => {
				if (cancelled) {
					return;
				}
				void refreshUnreadCount();
				cancelPushBootstrap = scheduleIdleTask(() => {
					if (!cancelled) {
						void ensurePushSubscription();
					}
				});
			});
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState !== "visible") {
				return;
			}
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			bootstrap();
		};

		if (document.visibilityState === "hidden") {
			document.addEventListener("visibilitychange", handleVisibilityChange);
		} else {
			bootstrap();
		}

		return () => {
			cancelled = true;
			cancelUnreadBootstrap();
			cancelPushBootstrap();
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [ensurePushSubscription, refreshUnreadCount, sessionUserId]);

	useRealtimeBroadcast(
		sessionUserId ? REALTIME_TOPICS.user(sessionUserId) : null,
		{
			[REALTIME_EVENTS.NOTIFICATION_CREATED]: (payload) => {
				showMentionBrowserNotification(payload);
				void refreshUnreadCount();
			},
			[REALTIME_EVENTS.NOTIFICATION_READ_CHANGED]: (payload) => {
				const unreadCount = Number(payload.unreadCount ?? NaN);
				if (Number.isFinite(unreadCount)) {
					setUnreadCount(unreadCount);
					return;
				}
				void refreshUnreadCount();
			},
		}
	);

	return {
		unreadCount,
		refreshUnreadCount,
	};
}
