import webpush from "web-push";
import { assertSafeHttpUrl } from "@/lib/network-guard";

export interface PushSubscriptionPayload {
	endpoint: string;
	keys: {
		p256dh: string;
		auth: string;
	};
	expirationTime?: number | null;
}

interface PushConfig {
	publicKey: string;
	privateKey: string;
	subject: string;
}

let configuredVapidPublicKey: string | null = null;

function resolvePushConfig(): PushConfig | null {
	const publicKey = (process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
	const privateKey = (process.env.VAPID_PRIVATE_KEY ?? "").trim();
	const subject = (process.env.VAPID_SUBJECT ?? "").trim();
	if (!publicKey || !privateKey || !subject) {
		return null;
	}
	return {
		publicKey,
		privateKey,
		subject,
	};
}

export function getClientVapidPublicKey(): string {
	return (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "").trim();
}

export function ensureWebPushConfigured(): PushConfig {
	const config = resolvePushConfig();
	if (!config) {
		throw new Error("push_env_not_configured");
	}
	if (configuredVapidPublicKey !== config.publicKey) {
		webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
		configuredVapidPublicKey = config.publicKey;
	}
	return config;
}

function toNonEmptyString(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return null;
	}
	return trimmed;
}

function isPrivateIpv4Host(hostname: string): boolean {
	const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
	if (!match) {
		return false;
	}
	const octets = match.slice(1).map((item) => Number.parseInt(item, 10));
	if (octets.some((item) => Number.isNaN(item) || item < 0 || item > 255)) {
		return false;
	}
	if (octets[0] === 10 || octets[0] === 127) {
		return true;
	}
	if (octets[0] === 192 && octets[1] === 168) {
		return true;
	}
	if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
		return true;
	}
	return false;
}

function isValidPushEndpoint(endpoint: string): boolean {
	if (endpoint.length > 2000) {
		return false;
	}
	try {
		const parsed = new URL(endpoint);
		if (parsed.protocol !== "https:") {
			return false;
		}
		const host = parsed.hostname.toLowerCase();
		if (host === "localhost" || host.endsWith(".local") || isPrivateIpv4Host(host)) {
			return false;
		}
		return true;
	} catch {
		return false;
	}
}

export function parsePushSubscriptionPayload(payload: unknown): PushSubscriptionPayload | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	const candidate = payload as Record<string, unknown>;
	const endpoint = toNonEmptyString(candidate.endpoint);
	if (!endpoint) {
		return null;
	}
	if (!isValidPushEndpoint(endpoint)) {
		return null;
	}
	const keys = candidate.keys;
	if (!keys || typeof keys !== "object") {
		return null;
	}
	const keyRecord = keys as Record<string, unknown>;
	const p256dh = toNonEmptyString(keyRecord.p256dh);
	const auth = toNonEmptyString(keyRecord.auth);
	if (!p256dh || !auth) {
		return null;
	}
	if (p256dh.length > 512 || auth.length > 512) {
		return null;
	}
	const expirationTime =
		typeof candidate.expirationTime === "number" || candidate.expirationTime === null
			? candidate.expirationTime
			: undefined;
	return {
		endpoint,
		keys: { p256dh, auth },
		expirationTime,
	};
}

export async function parsePushSubscriptionPayloadAsync(payload: unknown): Promise<PushSubscriptionPayload | null> {
	const parsed = parsePushSubscriptionPayload(payload);
	if (!parsed) {
		return null;
	}
	try {
		await assertSafeHttpUrl(new URL(parsed.endpoint));
		return parsed;
	} catch {
		return null;
	}
}

export function buildDeliveryDedupeKey(notificationId: number, channel: string, subscriptionId: number | null): string {
	const normalizedSubscriptionId = subscriptionId && subscriptionId > 0 ? String(subscriptionId) : "none";
	return `notif:${notificationId}:channel:${channel}:sub:${normalizedSubscriptionId}`;
}

export function getNotificationTargetUrl(input: { postId: number | null; commentId: number | null }): string {
	if (input.postId && input.postId > 0) {
		if (input.commentId && input.commentId > 0) {
			return `/posts/${input.postId}#comment-${input.commentId}`;
		}
		return `/posts/${input.postId}`;
	}
	return "/notifications";
}

export function getRetryDelayMs(attemptCount: number): number {
	if (attemptCount <= 1) {
		return 60_000;
	}
	if (attemptCount === 2) {
		return 5 * 60_000;
	}
	if (attemptCount === 3) {
		return 30 * 60_000;
	}
	if (attemptCount === 4) {
		return 2 * 60 * 60_000;
	}
	return 12 * 60 * 60_000;
}

export async function sendWebPush(
	subscription: PushSubscriptionPayload,
	payload: string
): Promise<{ ok: true } | { ok: false; statusCode: number | null; message: string }> {
	try {
		ensureWebPushConfigured();
		await webpush.sendNotification(subscription, payload);
		return { ok: true };
	} catch (error) {
		if (error && typeof error === "object") {
			const errorRecord = error as Record<string, unknown>;
			const statusCode = typeof errorRecord.statusCode === "number" ? errorRecord.statusCode : null;
			const message = typeof errorRecord.message === "string" ? errorRecord.message : "push_send_failed";
			return { ok: false, statusCode, message };
		}
		return { ok: false, statusCode: null, message: "push_send_failed" };
	}
}
