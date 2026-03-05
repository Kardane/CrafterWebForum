import { describe, expect, it } from "vitest";
import { readJsonBody } from "@/lib/http-body";

describe("http body utils", () => {
	it("throws payload_too_large when content-length exceeds limit", async () => {
		const request = new Request("http://localhost/api/test", {
			method: "POST",
			headers: {
				"content-type": "application/json",
				"content-length": "2048",
			},
			body: JSON.stringify({ hello: "world" }),
		});

		await expect(readJsonBody(request, { maxBytes: 128 })).rejects.toMatchObject({
			code: "payload_too_large",
			status: 413,
		});
	});

	it("throws invalid_json when body is malformed", async () => {
		const request = new Request("http://localhost/api/test", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: "{bad-json",
		});

		await expect(readJsonBody(request)).rejects.toMatchObject({
			code: "invalid_json",
			status: 400,
		});
	});
});
