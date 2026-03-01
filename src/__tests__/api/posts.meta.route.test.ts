import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authMock = vi.fn();
const postFindManyMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			findMany: postFindManyMock,
		},
	},
}));

describe("GET /api/posts/meta", () => {
	beforeEach(() => {
		authMock.mockReset();
		postFindManyMock.mockReset();
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);
		const { GET } = await import("@/app/api/posts/meta/route");
		const req = new NextRequest("http://localhost/api/posts/meta?ids=10,20");

		const res = await GET(req);
		expect(res.status).toBe(401);
	});

	it("returns 400 when ids are invalid", async () => {
		authMock.mockResolvedValue({ user: { id: "1" } });
		const { GET } = await import("@/app/api/posts/meta/route");
		const req = new NextRequest("http://localhost/api/posts/meta?ids=abc");

		const res = await GET(req);
		expect(res.status).toBe(400);
	});

	it("returns normalized post metadata for valid ids", async () => {
		authMock.mockResolvedValue({ user: { id: "1" } });
		postFindManyMock.mockResolvedValue([
			{
				id: 11,
				tags: '["질문"]',
				views: 22,
				likes: 7,
				commentCount: 5,
			},
			{
				id: 12,
				tags: null,
				views: 3,
				likes: 0,
				commentCount: 1,
			},
		]);

		const { GET } = await import("@/app/api/posts/meta/route");
		const req = new NextRequest("http://localhost/api/posts/meta?ids=11,12,999");
		const res = await GET(req);

		expect(res.status).toBe(200);
		const payload = (await res.json()) as {
			items: Array<{
				id: number;
				category: string;
				views: number;
				likes: number;
				comments: number;
			}>;
		};

		expect(postFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({
					id: { in: [11, 12, 999] },
				}),
			})
		);
		expect(payload.items).toEqual([
			{ id: 11, category: "질문", views: 22, likes: 7, comments: 5 },
			{ id: 12, category: "일반", views: 3, likes: 0, comments: 1 },
		]);
	});

	it("returns 304 when if-none-match matches generated etag", async () => {
		authMock.mockResolvedValue({ user: { id: "1" } });
		postFindManyMock.mockResolvedValue([
			{
				id: 77,
				tags: '["notice"]',
				views: 8,
				likes: 2,
				commentCount: 1,
			},
		]);

		const { GET } = await import("@/app/api/posts/meta/route");
		const url = "http://localhost/api/posts/meta?ids=77";
		const first = await GET(new NextRequest(url));
		expect(first.status).toBe(200);

		const etag = first.headers.get("etag");
		expect(etag).toBeTruthy();

		const second = await GET(
			new NextRequest(url, {
				headers: {
					"if-none-match": etag || "",
				},
			})
		);
		expect(second.status).toBe(304);
		expect(second.headers.get("etag")).toBe(etag);
	});
});
