import { describe, expect, it } from "vitest";

describe("GET /api/auth/profile (deprecated → 410 Gone)", () => {
	it("returns 410 Gone with migration message", async () => {
		const { GET } = await import("@/app/api/auth/profile/route");
		const res = await GET();
		const body = await res.json();

		expect(res.status).toBe(410);
		expect(body.error).toBe("gone");
		expect(body.message).toContain("/api/users/me");
	});
});
