import { describe, expect, it } from "vitest";

describe("PUT /api/auth/password (deprecated → 410 Gone)", () => {
	it("returns 410 Gone with migration message", async () => {
		const { PUT } = await import("@/app/api/auth/password/route");
		const res = await PUT();
		const body = await res.json();

		expect(res.status).toBe(410);
		expect(body.error).toBe("gone");
		expect(body.message).toContain("/api/users/me/password");
	});
});
