"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

interface PushSubscriptionInfo {
	id: number;
	createdAt: string;
	updatedAt: string;
}

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

export default function PushSubscriptionPanel() {
	const [subscriptions, setSubscriptions] = useState<PushSubscriptionInfo[]>([]);
	const [permission, setPermission] = useState<string>("unsupported");
	const [hasBrowserSubscription, setHasBrowserSubscription] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	const supported = typeof window !== "undefined" && !!window.Notification && !!window.PushManager && !!navigator.serviceWorker;

	const refreshState = useCallback(async () => {
		setIsLoading(true);
		if (!supported) {
			setPermission("unsupported");
			setHasBrowserSubscription(false);
			setSubscriptions([]);
			setIsLoading(false);
			return;
		}

		setPermission(Notification.permission);

		try {
			const registration = await navigator.serviceWorker.register("/sw.js");
			const browserSubscription = await registration.pushManager.getSubscription();
			setHasBrowserSubscription(Boolean(browserSubscription));
		} catch {
			setHasBrowserSubscription(false);
		}

		try {
			const response = await fetch("/api/push/subscribe", { cache: "no-store" });
			if (!response.ok) {
				setSubscriptions([]);
				setIsLoading(false);
				return;
			}
			const payload = (await response.json()) as { subscriptions?: PushSubscriptionInfo[] };
			setSubscriptions(Array.isArray(payload.subscriptions) ? payload.subscriptions : []);
		} catch {
			setSubscriptions([]);
		} finally {
			setIsLoading(false);
		}
	}, [supported]);

	useEffect(() => {
		void refreshState();
	}, [refreshState]);

	const subscribe = async () => {
		if (!supported) {
			setStatusMessage("이 브라우저는 Web Push를 지원하지 않음");
			return;
		}

		const vapidPublicKey = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
		if (!vapidPublicKey) {
			setStatusMessage("NEXT_PUBLIC_VAPID_PUBLIC_KEY 미설정 상태");
			return;
		}

		setIsSubmitting(true);
		setStatusMessage(null);

		try {
			const registration = await navigator.serviceWorker.register("/sw.js");
			let currentPermission = Notification.permission;
			if (currentPermission === "default") {
				currentPermission = await Notification.requestPermission();
			}
			if (currentPermission !== "granted") {
				setStatusMessage("알림 권한 허용 필요");
				return;
			}

			const existing = await registration.pushManager.getSubscription();
			const subscription =
				existing ??
				(await registration.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: base64UrlToArrayBuffer(vapidPublicKey),
				}));

			const response = await fetch("/api/push/subscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(subscription),
			});
			if (!response.ok) {
				setStatusMessage("구독 저장 실패");
				return;
			}

			setStatusMessage("푸시 구독 완료");
			await refreshState();
		} catch {
			setStatusMessage("구독 처리 중 오류 발생");
		} finally {
			setIsSubmitting(false);
		}
	};

	const toggleSubscription = async () => {
		if (hasBrowserSubscription) {
			await unsubscribe();
			return;
		}
		await subscribe();
	};

	const unsubscribe = async () => {
		if (!supported) {
			setStatusMessage("이 브라우저는 Web Push를 지원하지 않음");
			return;
		}

		setIsSubmitting(true);
		setStatusMessage(null);

		try {
			const registration = await navigator.serviceWorker.register("/sw.js");
			const existing = await registration.pushManager.getSubscription();
			if (!existing) {
				setStatusMessage("현재 브라우저 구독 없음");
				await refreshState();
				return;
			}

			const endpoint = existing.endpoint;
			await existing.unsubscribe();

			const response = await fetch("/api/push/unsubscribe", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ endpoint }),
			});
			if (!response.ok) {
				setStatusMessage("구독 해제 저장 실패");
				return;
			}

			setStatusMessage("현재 브라우저 구독 해제 완료");
			await refreshState();
		} catch {
			setStatusMessage("구독 해제 중 오류 발생");
		} finally {
			setIsSubmitting(false);
		}
	};

	const permissionLabel = useMemo(() => {
		if (!supported) {
			return "지원 안함";
		}
		if (permission === "granted") {
			return "허용";
		}
		if (permission === "denied") {
			return "거부";
		}
		return "미결정";
	}, [permission, supported]);

	const subscribedAtLabel = useMemo(() => {
		if (isLoading) {
			return "확인 중...";
		}
		if (subscriptions.length === 0) {
			return "없음";
		}
		const latest = subscriptions
			.map((subscription) => new Date(subscription.createdAt).getTime())
			.filter((value) => Number.isFinite(value))
			.sort((a, b) => b - a)[0];
		if (!latest) {
			return "없음";
		}
		return new Date(latest).toLocaleString();
	}, [isLoading, subscriptions]);

	return (
		<section className="bg-bg-secondary rounded-lg border border-bg-tertiary p-6">
			<div className="mb-4 flex items-center justify-between gap-3">
				<h2 className="text-lg font-semibold">푸시 구독</h2>
				<div className="flex items-center gap-2">
					<button
						type="button"
						role="switch"
						aria-checked={hasBrowserSubscription}
						onClick={() => void toggleSubscription()}
						disabled={isSubmitting || !supported}
						className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
							hasBrowserSubscription ? "bg-accent" : "bg-bg-tertiary"
						} ${isSubmitting || !supported ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
						title="푸시 구독 토글"
					>
						<span
							className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
								hasBrowserSubscription ? "translate-x-6" : "translate-x-1"
							}`}
						/>
					</button>
					<button
						type="button"
						className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-secondary hover:bg-bg-tertiary"
						onClick={() => void refreshState()}
						disabled={isSubmitting}
						title="새로고침"
					>
						<RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
						<span className="sr-only">새로고침</span>
					</button>
				</div>
			</div>

			<div className="space-y-1 text-sm text-text-secondary mb-4">
				<p>브라우저 권한: {permissionLabel}</p>
				<p>구독한 날짜: {subscribedAtLabel}</p>
			</div>

			{statusMessage && <p className="text-sm text-text-muted mb-3">{statusMessage}</p>}
		</section>
	);
}
