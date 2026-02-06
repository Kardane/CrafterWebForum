import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/register/route";

describe("POST /api/auth/register", () => {
	it("returns 400 when code is missing", async () => {
		const req = new Request("http://localhost/api/auth/register", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ nickname: "tester", password: "pass1234!" }),
		});
		const res = await POST(req as never);
		expect(res.status).toBe(400);
	});
});

