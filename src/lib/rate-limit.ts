import { NextResponse } from "next/server";
import { isIP } from "node:net";

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

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
const RATE_LIMIT_TRUST_PROXY_HOPS = Math.max(
	0,
	Number.parseInt(process.env.RATE_LIMIT_TRUST_PROXY_HOPS ?? "1", 10) || 0
);

function getStore(): Map<string, Bucket> {
	if (!globalRateLimit.store) {
		globalRateLimit.store = new Map<string, Bucket>();
	}
	return globalRateLimit.store;
}

function normalizeIp(value: string): string | null {
	const trimmed = value.trim().replace(/^\[|\]$/g, "");
	if (!trimmed) {
		return null;
	}
	return isIP(trimmed) ? trimmed : null;
}

function parseIpList(headerValue: string | null): string[] {
	if (!headerValue) {
		return [];
	}
	return headerValue
		.split(",")
		.map((value) => normalizeIp(value))
		.filter((value): value is string => Boolean(value));
}

function selectForwardedClientIp(ips: string[]): string | null {
	if (ips.length === 0) {
		return null;
	}
	const index = ips.length - 1 - RATE_LIMIT_TRUST_PROXY_HOPS;
	if (index >= 0 && index < ips.length) {
		return ips[index] ?? null;
	}
	return ips[0] ?? null;
}

function getClientIp(request: Request): string {
	const realIp = request.headers.get("x-real-ip");
	if (realIp) {
		const normalized = normalizeIp(realIp);
		if (normalized) {
			return normalized;
		}
	}

	const forwardedForClientIp = selectForwardedClientIp(
		parseIpList(request.headers.get("x-forwarded-for"))
	);
	if (forwardedForClientIp) {
		return forwardedForClientIp;
	}

	const vercelForwardedClientIp = selectForwardedClientIp(
		parseIpList(request.headers.get("x-vercel-forwarded-for"))
	);
	if (vercelForwardedClientIp) {
		return vercelForwardedClientIp;
	}

	return "unknown";
}

function getBucketKey(request: Request, policy: RateLimitPolicy, identifier?: string): string {
	const normalizedIdentifier = identifier && identifier.trim().length > 0 ? identifier.trim() : "anonymous";
	return `${policy.namespace}:${getClientIp(request)}:${normalizedIdentifier}`;
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

export function enforceRateLimit(request: Request, policy: RateLimitPolicy, identifier?: string): NextResponse | null {
	return enforceRateLimitMemory(request, policy, identifier);
}

async function upstashIncrWithWindow(key: string, windowMs: number): Promise<{ count: number; resetAt: number } | null> {
	if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
		return null;
	}

	const requestInit: RequestInit = {
		method: "POST",
		headers: {
			Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
			"Content-Type": "application/json",
		},
	};

	try {
		const incrResponse = await fetch(`${UPSTASH_REDIS_REST_URL}/incr/${encodeURIComponent(key)}`, requestInit);
		if (!incrResponse.ok) {
			return null;
		}
		const incrData = (await incrResponse.json()) as { result?: unknown };
		const count = Number(incrData.result ?? 0);
		if (!Number.isFinite(count) || count <= 0) {
			return null;
		}

		if (count === 1) {
			await fetch(`${UPSTASH_REDIS_REST_URL}/pexpire/${encodeURIComponent(key)}/${windowMs}`, requestInit);
		}

		const ttlResponse = await fetch(`${UPSTASH_REDIS_REST_URL}/pttl/${encodeURIComponent(key)}`, requestInit);
		if (!ttlResponse.ok) {
			return null;
		}
		const ttlData = (await ttlResponse.json()) as { result?: unknown };
		const pttl = Number(ttlData.result ?? -1);
		if (!Number.isFinite(pttl) || pttl <= 0) {
			return { count, resetAt: Date.now() + windowMs };
		}

		return { count, resetAt: Date.now() + pttl };
	} catch {
		return null;
	}
}

function enforceRateLimitMemory(request: Request, policy: RateLimitPolicy, identifier?: string): NextResponse | null {
	const now = Date.now();
	cleanupExpiredBuckets(now);

	const key = getBucketKey(request, policy, identifier);
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

export async function enforceRateLimitAsync(
	request: Request,
	policy: RateLimitPolicy,
	identifier?: string
): Promise<NextResponse | null> {
	const key = getBucketKey(request, policy, identifier);
	const distributed = await upstashIncrWithWindow(key, policy.windowMs);
	if (distributed) {
		if (distributed.count > policy.limit) {
			const retryAfterSec = Math.max(1, Math.ceil((distributed.resetAt - Date.now()) / 1000));
			return buildRateLimitedResponse(retryAfterSec, policy, distributed.resetAt);
		}
		return null;
	}

	return enforceRateLimitMemory(request, policy, identifier);
}

export function resetRateLimitStore(): void {
	getStore().clear();
	globalRateLimit.lastCleanupAt = 0;
}
