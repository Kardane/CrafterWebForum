"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRealtimeBroadcast } from "@/lib/realtime/useRealtimeBroadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";

export function useNotifications() {
	const { data: session } = useSession();
	const sessionUserId = Number(session?.user?.id ?? 0);
	const [unreadCount, setUnreadCount] = useState(0);

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
		const timer = window.setTimeout(() => {
			void refreshUnreadCount();
		}, 0);
		return () => {
			window.clearTimeout(timer);
		};
	}, [refreshUnreadCount]);

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
