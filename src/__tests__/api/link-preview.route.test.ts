import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimitStore } from "@/lib/rate-limit";

const fetchMock = vi.fn();

describe("GET /api/link-preview", () => {
	beforeEach(() => {
		resetRateLimitStore();
		fetchMock.mockReset();
		vi.stubGlobal("fetch", fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("rejects invalid url", async () => {
		const { GET } = await import("@/app/api/link-preview/route");
		const req = new NextRequest("http://localhost/api/link-preview?url=not-a-url");
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it("rejects localhost/private hosts", async () => {
		const { GET } = await import("@/app/api/link-preview/route");
		const req = new NextRequest("http://localhost/api/link-preview?url=http://127.0.0.1:3000/test");
		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it("returns github repository preview metadata", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					description: "React framework",
					owner: { avatar_url: "https://avatars.githubusercontent.com/u/14985020?v=4" },
					stargazers_count: 100,
					forks_count: 20,
					open_issues_count: 5,
					language: "TypeScript",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			)
		);

		const { GET } = await import("@/app/api/link-preview/route");
		const targetUrl = encodeURIComponent("https://github.com/vercel/next.js?cache_case=ttl-spec");
		const req = new NextRequest(`http://localhost/api/link-preview?url=${targetUrl}`);
		const res = await GET(req);
		expect(res.status).toBe(200);
		const payload = (await res.json()) as {
			preview: {
				provider: string;
				kind: string;
				title: string;
				metrics: string[];
			};
		};
		expect(payload.preview.provider).toBe("github");
		expect(payload.preview.kind).toBe("repository");
		expect(payload.preview.title).toBe("vercel/next.js");
		expect(payload.preview.metrics.some((item) => item.includes("스타"))).toBe(true);
		expect(payload.preview.metrics.some((item) => item.includes("포크"))).toBe(true);
	});

	it("reuses in-memory ttl cache for repeated url requests", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					description: "Next.js framework",
					owner: { avatar_url: "https://avatars.githubusercontent.com/u/14985020?v=4" },
					stargazers_count: 120,
					forks_count: 30,
					open_issues_count: 8,
					language: "TypeScript",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			)
		);

		const { GET } = await import("@/app/api/link-preview/route");
		const targetUrl = encodeURIComponent("https://github.com/vercel/next.js");

		const first = new NextRequest(`http://localhost/api/link-preview?url=${targetUrl}`);
		const firstResponse = await GET(first);
		expect(firstResponse.status).toBe(200);
		expect(firstResponse.headers.get("server-timing") ?? "").toContain("cache miss");
		expect(fetchMock).toHaveBeenCalledTimes(1);

		const second = new NextRequest(`http://localhost/api/link-preview?url=${targetUrl}`);
		const secondResponse = await GET(second);
		expect(secondResponse.status).toBe(200);
		expect(secondResponse.headers.get("server-timing") ?? "").toContain("cache hit");
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
