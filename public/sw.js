self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
	if (!event.data) {
		return;
	}
	let payload = {};
	try {
		payload = event.data.json();
	} catch {
		return;
	}
	const title = typeof payload.title === "string" && payload.title ? payload.title : "새 알림";
	const body = typeof payload.body === "string" && payload.body ? payload.body : "새 알림이 도착했음";
	const targetUrl = typeof payload.targetUrl === "string" && payload.targetUrl ? payload.targetUrl : "/notifications";

	event.waitUntil(
		self.registration.showNotification(title, {
			body,
			icon: "/favicon-32.png",
			badge: "/favicon-32.png",
			tag: `notification-${Date.now()}`,
			data: { targetUrl },
		})
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const targetUrl = event.notification?.data?.targetUrl || "/notifications";

	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
			for (const client of clients) {
				if ("focus" in client) {
					client.navigate(targetUrl);
					return client.focus();
				}
			}
			if (self.clients.openWindow) {
				return self.clients.openWindow(targetUrl);
			}
			return null;
		})
	);
});
