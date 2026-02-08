import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enforceRateLimit, resetRateLimitStore, type RateLimitPolicy } from "@/lib/rate-limit";

const TEST_POLICY: RateLimitPolicy = {
	namespace: "test:rate-limit",
	limit: 2,
	windowMs: 1_000,
};

function createRequest(ip: string): Request {
	return new Request("http://localhost/api/test", {
		headers: {
			"x-forwarded-for": ip,
		},
	});
}

describe("rate-limit", () => {
	beforeEach(() => {
		resetRateLimitStore();
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-08T00:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
		resetRateLimitStore();
	});

	it("allows requests within the limit", () => {
		const req = createRequest("203.0.113.10");
		expect(enforceRateLimit(req, TEST_POLICY)).toBeNull();
		expect(enforceRateLimit(req, TEST_POLICY)).toBeNull();
	});

	it("blocks requests after the limit is reached", async () => {
		const req = createRequest("203.0.113.11");
		enforceRateLimit(req, TEST_POLICY);
		enforceRateLimit(req, TEST_POLICY);

		const blocked = enforceRateLimit(req, TEST_POLICY);
		expect(blocked?.status).toBe(429);

		const payload = await blocked?.json();
		expect(payload).toEqual({ error: "rate_limited" });
		expect(blocked?.headers.get("Retry-After")).toBe("1");
	});

	it("separates counters by ip", () => {
		const firstReq = createRequest("203.0.113.12");
		const secondReq = createRequest("203.0.113.13");

		enforceRateLimit(firstReq, TEST_POLICY);
		enforceRateLimit(firstReq, TEST_POLICY);
		expect(enforceRateLimit(firstReq, TEST_POLICY)?.status).toBe(429);

		expect(enforceRateLimit(secondReq, TEST_POLICY)).toBeNull();
	});

	it("resets the limit after the window expires", () => {
		const req = createRequest("203.0.113.14");
		enforceRateLimit(req, TEST_POLICY);
		enforceRateLimit(req, TEST_POLICY);
		expect(enforceRateLimit(req, TEST_POLICY)?.status).toBe(429);

		vi.advanceTimersByTime(1_001);
		expect(enforceRateLimit(req, TEST_POLICY)).toBeNull();
	});
});
