import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/posts/route";

describe("POST /api/posts", () => {
	it("returns 400 when required fields are missing", async () => {
		const req = new Request("http://localhost/api/posts", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title: "x" }),
		});

		const res = await POST(req as never);
		expect(res.status).toBe(400);
	});
});

