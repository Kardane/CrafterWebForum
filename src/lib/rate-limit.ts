import { NextResponse } from "next/server";

export type RateLimitPolicy = {
	namespace: string;
	limit: number;
	windowMs: number;
};

type Bucket = {
	count: number;
	resetAt: number;
};

const CLEANUP_INTERVAL_MS = 60_000;

type GlobalRateLimitStore = {
	store?: Map<string, Bucket>;
	lastCleanupAt?: number;
};

const globalRateLimit = globalThis as typeof globalThis & GlobalRateLimitStore;

function getStore(): Map<string, Bucket> {
	if (!globalRateLimit.store) {
		globalRateLimit.store = new Map<string, Bucket>();
	}
	return globalRateLimit.store;
}

function getClientIp(request: Request): string {
	const forwardedFor = request.headers.get("x-forwarded-for");
	if (forwardedFor) {
		return forwardedFor.split(",")[0].trim();
	}

	const realIp = request.headers.get("x-real-ip");
	if (realIp) {
		return realIp.trim();
	}

	return "unknown";
}

function getBucketKey(request: Request, policy: RateLimitPolicy): string {
	return `${policy.namespace}:${getClientIp(request)}`;
}

function cleanupExpiredBuckets(now: number): void {
	const lastCleanupAt = globalRateLimit.lastCleanupAt ?? 0;
	if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) {
		return;
	}

	const store = getStore();
	for (const [key, bucket] of store.entries()) {
		if (bucket.resetAt <= now) {
			store.delete(key);
		}
	}
	globalRateLimit.lastCleanupAt = now;
}

function buildRateLimitedResponse(retryAfterSec: number, policy: RateLimitPolicy, resetAt: number) {
	return NextResponse.json(
		{ error: "rate_limited" },
		{
			status: 429,
			headers: {
				"Retry-After": String(retryAfterSec),
				"X-RateLimit-Limit": String(policy.limit),
				"X-RateLimit-Remaining": "0",
				"X-RateLimit-Reset": String(Math.floor(resetAt / 1000)),
			},
		}
	);
}

export function enforceRateLimit(request: Request, policy: RateLimitPolicy): NextResponse | null {
	const now = Date.now();
	cleanupExpiredBuckets(now);

	const key = getBucketKey(request, policy);
	const store = getStore();
	const current = store.get(key);

	if (!current || current.resetAt <= now) {
		store.set(key, {
			count: 1,
			resetAt: now + policy.windowMs,
		});
		return null;
	}

	if (current.count >= policy.limit) {
		const retryAfterSec = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
		return buildRateLimitedResponse(retryAfterSec, policy, current.resetAt);
	}

	current.count += 1;
	store.set(key, current);
	return null;
}

export function resetRateLimitStore(): void {
	getStore().clear();
	globalRateLimit.lastCleanupAt = 0;
}
