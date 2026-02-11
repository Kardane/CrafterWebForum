import { describe, expect, it } from "vitest";
import { MAX_UPLOAD_MB } from "@/lib/upload-constants";
import {
	parseUploadJsonResponse,
	parseUploadXhrError,
} from "@/lib/upload-response";

describe("upload response parsing", () => {
	it("parses successful json payload", async () => {
		const response = new Response(
			JSON.stringify({ url: "https://example.com/file.mp4", type: "video" }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);

		const parsed = await parseUploadJsonResponse<{ url: string; type: string }>(
			response
		);

		expect(parsed.error).toBeNull();
		expect(parsed.data?.url).toBe("https://example.com/file.mp4");
	});

	it("returns friendly message for non-json 413 response", async () => {
		const response = new Response("Request Entity Too Large", {
			status: 413,
			headers: { "Content-Type": "text/plain" },
		});

		const parsed = await parseUploadJsonResponse(response);

		expect(parsed.data).toBeNull();
		expect(parsed.error).toBe(
			`파일이 너무 큼. ${MAX_UPLOAD_MB}MB 이하 파일만 업로드 가능`
		);
	});

	it("returns payload error when response body is json", async () => {
		const response = new Response(JSON.stringify({ error: "custom error" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});

		const parsed = await parseUploadJsonResponse(response);

		expect(parsed.data).toBeNull();
		expect(parsed.error).toBe("custom error");
	});

	it("maps xhr plain text 413 to friendly message", () => {
		const message = parseUploadXhrError(413, "Request Entity Too Large");
		expect(message).toBe(`파일이 너무 큼. ${MAX_UPLOAD_MB}MB 이하 파일만 업로드 가능`);
	});
});
