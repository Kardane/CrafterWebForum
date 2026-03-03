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
			stats?: { stars?: number; forks?: number; issues?: number };
		};
	};
	expect(payload.preview.provider).toBe("github");
	expect(payload.preview.kind).toBe("repository");
	expect(payload.preview.title).toBe("vercel/next.js");
	expect(payload.preview.stats?.stars).toBe(100);
	expect(payload.preview.stats?.forks).toBeUndefined();
	expect(payload.preview.stats?.issues).toBe(5);
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

	it("returns github issue preview with author avatar and labels", async () => {
		fetchMock
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						description: "Next.js framework",
						owner: { avatar_url: "https://avatars.githubusercontent.com/u/14985020?v=4", login: "vercel" },
						stargazers_count: 120,
						forks_count: 30,
						open_issues_count: 8,
						language: "TypeScript",
						visibility: "public",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						title: "Bug: something broken",
						body: "details",
						state: "open",
						comments: 9,
						labels: [{ name: "bug" }, { name: "perf" }],
						user: { login: "reporter", avatar_url: "https://avatars.example.com/u/1" },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			);

		const { GET } = await import("@/app/api/link-preview/route");
		const targetUrl = encodeURIComponent("https://github.com/vercel/next.js/issues/123");
		const req = new NextRequest(`http://localhost/api/link-preview?url=${targetUrl}`);
		const res = await GET(req);
		expect(res.status).toBe(200);
		const payload = (await res.json()) as {
			preview: {
				kind: string;
				badge: string;
				authorName?: string;
				authorAvatarUrl?: string;
				chips: string[];
				metrics: string[];
				stats?: { stars?: number; forks?: number };
			};
		};
		expect(payload.preview.kind).toBe("issue");
		expect(payload.preview.badge).toContain("이슈");
		expect(payload.preview.authorName).toBe("reporter");
		expect(payload.preview.authorAvatarUrl).toBe("https://avatars.example.com/u/1");
		expect(payload.preview.chips.join(" ")).toContain("bug");
		expect(payload.preview.metrics.join(" ")).toContain("댓글");
		expect(payload.preview.stats?.stars).toBe(120);
		expect(payload.preview.stats?.forks).toBe(30);
	});

	it("returns github pull request preview with diff metrics", async () => {
		fetchMock
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						owner: { avatar_url: "https://avatars.githubusercontent.com/u/14985020?v=4", login: "vercel" },
						stargazers_count: 10,
						forks_count: 2,
						open_issues_count: 1,
						language: "TypeScript",
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						title: "Improve perf",
						body: "details",
						state: "open",
						draft: true,
						merged_at: null,
						commits: 3,
						changed_files: 5,
						additions: 40,
						deletions: 10,
						comments: 2,
						review_comments: 4,
						user: { login: "author", avatar_url: "https://avatars.example.com/u/2" },
						head: { ref: "feature" },
						base: { ref: "main" },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			);

		const { GET } = await import("@/app/api/link-preview/route");
		const targetUrl = encodeURIComponent("https://github.com/vercel/next.js/pull/999");
		const req = new NextRequest(`http://localhost/api/link-preview?url=${targetUrl}`);
		const res = await GET(req);
		expect(res.status).toBe(200);
		const payload = (await res.json()) as { preview: { kind: string; status?: string; metrics: string[] } };
		expect(payload.preview.kind).toBe("pull_request");
		expect(payload.preview.status).toBe("DRAFT");
		expect(payload.preview.metrics.join(" ")).toContain("커밋");
		expect(payload.preview.metrics.join(" ")).toContain("파일");
		expect(payload.preview.metrics.join(" ")).toContain("추가");
		expect(payload.preview.metrics.join(" ")).toContain("삭제");
		expect(payload.preview.metrics.join(" ")).toContain("댓글");
	});

	it("returns github wiki preview with repo stats", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					description: "Wiki repo",
					owner: { avatar_url: "https://avatars.example.com/u/3", login: "owner" },
					stargazers_count: 7,
					forks_count: 1,
					open_issues_count: 0,
					language: "TypeScript",
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			)
		);

		const { GET } = await import("@/app/api/link-preview/route");
		const targetUrl = encodeURIComponent("https://github.com/owner/repo/wiki/Some-Page");
		const req = new NextRequest(`http://localhost/api/link-preview?url=${targetUrl}`);
		const res = await GET(req);
		expect(res.status).toBe(200);
		const payload = (await res.json()) as { preview: { kind: string; badge: string; title: string; stats?: { stars?: number; forks?: number } } };
		expect(payload.preview.kind).toBe("wiki");
		expect(payload.preview.badge).toContain("Wiki");
		expect(payload.preview.title).toBe("Some-Page");
		expect(payload.preview.stats?.stars).toBe(7);
		expect(payload.preview.stats?.forks).toBe(1);
	});

	it("returns modrinth project preview with metrics and no duplicate downloads stat", async () => {
		fetchMock.mockResolvedValueOnce(
			new Response(
				JSON.stringify({
					title: "Fabric API",
					description: "Hooks into Fabric.",
					icon_url: "https://cdn.modrinth.com/icon.png",
					project_type: "mod",
					downloads: 12345,
					followers: 321,
					updated: "2026-03-03T10:00:00Z",
					game_versions: ["1.20.1"],
					loaders: ["fabric"],
					categories: ["library", "utility"],
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			)
		);

		const { GET } = await import("@/app/api/link-preview/route");
		const targetUrl = encodeURIComponent("https://modrinth.com/mod/fabric-api");
		const req = new NextRequest(`http://localhost/api/link-preview?url=${targetUrl}`);
		const res = await GET(req);
		expect(res.status).toBe(200);
		const payload = (await res.json()) as {
			preview: {
				provider: string;
				kind: string;
				metrics?: string[];
				stats?: { downloads?: number; version?: string };
			};
		};
		expect(payload.preview.provider).toBe("modrinth");
		expect(payload.preview.kind).toBe("project");
		expect(payload.preview.metrics?.join(" ") ?? "").toContain("다운로드");
		expect(payload.preview.metrics?.join(" ") ?? "").toContain("좋아요");
		expect(payload.preview.stats?.downloads).toBeUndefined();
		expect(payload.preview.stats?.version).toBe("1.20.1");
	});
});
