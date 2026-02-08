import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const postFindFirstMock = vi.fn();
const likeFindFirstMock = vi.fn();
const commentFindManyMock = vi.fn();
const postReadUpsertMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			findFirst: postFindFirstMock,
		},
		like: {
			findFirst: likeFindFirstMock,
		},
		comment: {
			findMany: commentFindManyMock,
		},
		postRead: {
			upsert: postReadUpsertMock,
		},
	},
}));

describe("GET /api/posts/[id]", () => {
	beforeEach(() => {
		authMock.mockReset();
		postFindFirstMock.mockReset();
		likeFindFirstMock.mockReset();
		commentFindManyMock.mockReset();
		postReadUpsertMock.mockReset();
	});

	it("returns 401 when unauthenticated", async () => {
		authMock.mockResolvedValue(null);

		const { GET } = await import("@/app/api/posts/[id]/route");
		const req = new Request("http://localhost/api/posts/1");
		const res = await GET(req as never, { params: Promise.resolve({ id: "1" }) });

		expect(res.status).toBe(401);
	});

	it("returns nested comment tree with author object", async () => {
		authMock.mockResolvedValue({ user: { id: 1 } });
		postFindFirstMock.mockResolvedValue({
			id: 10,
			title: "title",
			content: "content",
			tags: "[]",
			likes: 2,
			views: 7,
			createdAt: new Date("2026-01-01T00:00:00.000Z"),
			updatedAt: new Date("2026-01-01T01:00:00.000Z"),
			authorId: 1,
			author: {
				id: 1,
				nickname: "writer",
				minecraftUuid: "uuid-1",
			},
		});
		likeFindFirstMock.mockResolvedValue(null);
		commentFindManyMock.mockResolvedValue([
			{
				id: 100,
				content: "parent",
				createdAt: new Date("2026-01-01T02:00:00.000Z"),
				updatedAt: new Date("2026-01-01T02:00:00.000Z"),
				isPinned: 0,
				parentId: null,
				author: {
					id: 2,
					nickname: "alice",
					minecraftUuid: null,
					role: "user",
				},
			},
			{
				id: 101,
				content: "child",
				createdAt: new Date("2026-01-01T02:01:00.000Z"),
				updatedAt: new Date("2026-01-01T02:01:00.000Z"),
				isPinned: 0,
				parentId: 100,
				author: {
					id: 3,
					nickname: "bob",
					minecraftUuid: "uuid-3",
					role: "admin",
				},
			},
		]);
		postReadUpsertMock.mockResolvedValue({});

		const { GET } = await import("@/app/api/posts/[id]/route");
		const req = new Request("http://localhost/api/posts/10");
		const res = await GET(req as never, { params: Promise.resolve({ id: "10" }) });
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(body.comments).toHaveLength(1);
		expect(body.comments[0].author).toEqual({
			id: 2,
			nickname: "alice",
			minecraftUuid: null,
			role: "user",
		});
		expect(body.comments[0].replies).toHaveLength(1);
		expect(body.comments[0].replies[0].author.role).toBe("admin");
	});
});
