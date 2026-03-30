import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const postFindManyMock = vi.fn();
const postCountMock = vi.fn();
const userFindManyMock = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
	requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			findMany: postFindManyMock,
			count: postCountMock,
		},
		user: {
			findMany: userFindManyMock,
		},
	},
}));

describe("GET /api/admin/posts", () => {
	beforeEach(() => {
		requireAdminMock.mockReset();
		postFindManyMock.mockReset();
		postCountMock.mockReset();
		userFindManyMock.mockReset();

		requireAdminMock.mockResolvedValue({
			session: { user: { id: "1", role: "admin" } },
		});
	});

	it("Prisma current database board 컬럼 오류면 tags fallback으로 신문고 목록을 반환해야 함", async () => {
		postFindManyMock
			.mockRejectedValueOnce(new Error("The column `board` does not exist in the current database."))
			.mockResolvedValueOnce([
				{
					id: 38,
					title: "신문고 포스트",
					tags: '["__sys:server:mc.sinmungo.kr","__sys:board:ombudsman"]',
					createdAt: new Date("2026-03-30T10:00:00.000Z"),
					deletedAt: null,
					authorId: 7,
				},
			]);
		postCountMock.mockResolvedValue(1);
		userFindManyMock.mockResolvedValue([{ id: 7, nickname: "작성자" }]);

		const { GET } = await import("@/app/api/admin/posts/route");
		const res = await GET(new Request("http://localhost/api/admin/posts"));
		const data = (await res.json()) as {
			posts: Array<{ id: number; board: string; serverAddress: string | null; authorName: string }>;
		};

		expect(res.status).toBe(200);
		expect(postFindManyMock).toHaveBeenNthCalledWith(1, {
			where: { deletedAt: null },
			orderBy: { createdAt: "desc" },
			skip: 0,
			take: 50,
			select: {
				id: true,
				title: true,
				board: true,
				serverAddress: true,
				createdAt: true,
				deletedAt: true,
				authorId: true,
			},
		});
		expect(postFindManyMock).toHaveBeenNthCalledWith(2, {
			where: { deletedAt: null },
			orderBy: { createdAt: "desc" },
			skip: 0,
			take: 50,
			select: {
				id: true,
				title: true,
				tags: true,
				createdAt: true,
				deletedAt: true,
				authorId: true,
			},
		});
		expect(data.posts).toEqual([
			expect.objectContaining({
				id: 38,
				board: "sinmungo",
				serverAddress: "mc.sinmungo.kr",
				authorName: "작성자",
			}),
		]);
	});
});
