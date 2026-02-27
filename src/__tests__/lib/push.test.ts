import { describe, expect, it } from "vitest";

import { parsePushSubscriptionPayload } from "@/lib/push";

describe("push payload parser", () => {
	it("accepts valid https endpoint", () => {
		const parsed = parsePushSubscriptionPayload({
			endpoint: "https://push.example.com/subscription/abc",
			keys: {
				p256dh: "p-key",
				auth: "auth-key",
			},
		});
		expect(parsed).not.toBeNull();
	});

	it("rejects non-https endpoint", () => {
		const parsed = parsePushSubscriptionPayload({
			endpoint: "http://push.example.com/subscription/abc",
			keys: {
				p256dh: "p-key",
				auth: "auth-key",
			},
		});
		expect(parsed).toBeNull();
	});

	it("rejects localhost/private endpoint", () => {
		const parsed = parsePushSubscriptionPayload({
			endpoint: "https://127.0.0.1/subscription/abc",
			keys: {
				p256dh: "p-key",
				auth: "auth-key",
			},
		});
		expect(parsed).toBeNull();
	});

	it("rejects overlong keys", () => {
		const parsed = parsePushSubscriptionPayload({
			endpoint: "https://push.example.com/subscription/abc",
			keys: {
				p256dh: "p".repeat(600),
				auth: "a".repeat(600),
			},
		});
		expect(parsed).toBeNull();
	});
});
