"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface NotificationItem {
	id: number;
	type: string;
	message: string;
	postId: number | null;
	commentId: number | null;
	isRead: number;
	createdAt: string;
	actor: {
		id: number;
		nickname: string;
	} | null;
}

export default function NotificationsPage() {
	const [notifications, setNotifications] = useState<NotificationItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const loadNotifications = useCallback(async () => {
		try {
			const response = await fetch("/api/notifications", { cache: "no-store" });
			if (!response.ok) {
				setNotifications([]);
				return;
			}
			const data = (await response.json()) as { notifications?: NotificationItem[] };
			setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
		} catch {
			setNotifications([]);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadNotifications();
	}, [loadNotifications]);

	const markAsRead = useCallback(async (notificationId: number) => {
		await fetch(`/api/notifications/${notificationId}/read`, {
			method: "PATCH",
		});
		setNotifications((prev) =>
			prev.map((item) =>
				item.id === notificationId
					? {
						...item,
						isRead: 1,
					}
					: item
			)
		);
	}, []);

	return (
		<div className="mx-auto max-w-4xl p-6">
			<header className="mb-6 flex items-center gap-3">
				<Link href="/develope" className="btn btn-secondary btn-sm">
					← 메인
				</Link>
				<h1 className="text-2xl font-bold">알림</h1>
			</header>

			{isLoading ? (
				<div className="py-12 text-center text-text-muted">알림 불러오는 중...</div>
			) : notifications.length === 0 ? (
				<div className="py-12 text-center text-text-muted">아직 알림이 없음</div>
			) : (
				<ul className="space-y-3">
					{notifications.map((notification) => (
						<li key={notification.id} className="rounded-lg border border-border bg-bg-secondary p-4">
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="text-sm text-text-primary">{notification.message}</div>
									<div className="mt-1 text-xs text-text-muted">
										{new Date(notification.createdAt).toLocaleString("ko-KR")}
									</div>
									{notification.postId && (
										<Link
											href={`/posts/${notification.postId}#comment-${notification.commentId ?? ""}`}
											className="mt-2 inline-block text-xs text-accent hover:underline"
											onClick={() => void markAsRead(notification.id)}
										>
											바로 이동
										</Link>
									)}
								</div>
								{notification.isRead === 0 ? (
									<button
										type="button"
										className="btn btn-secondary btn-sm"
										onClick={() => void markAsRead(notification.id)}
									>
										읽음 처리
									</button>
								) : (
									<span className="text-xs text-text-muted">읽음</span>
								)}
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
