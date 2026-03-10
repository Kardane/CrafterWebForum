import { beforeEach, describe, expect, it, vi } from "vitest";

const userFindUniqueMock = vi.fn();
const postFindManyMock = vi.fn();
const commentCountMock = vi.fn();
const postAggregateMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
	prisma: {
		user: {
			findUnique: userFindUniqueMock,
		},
		post: {
			findMany: postFindManyMock,
			aggregate: postAggregateMock,
		},
		comment: {
			count: commentCountMock,
		},
	},
}));

describe("getUserProfile", () => {
	beforeEach(() => {
		vi.resetModules();
		userFindUniqueMock.mockReset();
		postFindManyMock.mockReset();
		commentCountMock.mockReset();
		postAggregateMock.mockReset();
		userFindUniqueMock.mockResolvedValue({
			id: 3,
			email: "test@example.com",
			nickname: "tester",
			minecraftUuid: null,
			role: "user",
			createdAt: new Date("2026-02-01T00:00:00Z"),
			lastAuthAt: null,
		});
		commentCountMock.mockResolvedValue(4);
		postAggregateMock.mockResolvedValue({ _sum: { likes: 11 } });
	});

	it("returns board-specific stats from board column when available", async () => {
		postFindManyMock.mockResolvedValue([{ board: "develope" }, { board: "sinmungo" }]);

		const { getUserProfile } = await import("@/lib/user-service");
		const result = await getUserProfile(3);

		expect(result?.stats).toMatchObject({
			posts: 2,
			developePosts: 1,
			sinmungoPosts: 1,
			comments: 4,
			likesReceived: 11,
		});
	});

	it("falls back to tag metadata when Post.board column is missing", async () => {
		postFindManyMock
			.mockRejectedValueOnce(new Error("SQLITE_UNKNOWN: SQLite error: no such column: main.Post.board"))
			.mockResolvedValueOnce([
				{ tags: '["질문"]' },
				{ tags: '["__sys:server:mc.legacy.kr","__sys:board:ombudsman"]' },
			]);

		const { getUserProfile } = await import("@/lib/user-service");
		const result = await getUserProfile(3);

		expect(result?.stats).toMatchObject({
			posts: 2,
			developePosts: 1,
			sinmungoPosts: 1,
		});
		expect(postFindManyMock).toHaveBeenNthCalledWith(2, {
			where: { authorId: 3, deletedAt: null },
			select: { tags: true },
		});
	});
});
