import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
const resolveActiveUserFromSessionMock = vi.fn();
const postFindFirstMock = vi.fn();
const postUpdateMock = vi.fn();
const safeRevalidateTagsMock = vi.fn();

vi.mock("@/auth", () => ({
	auth: authMock,
}));

vi.mock("@/lib/active-user", () => ({
	resolveActiveUserFromSession: resolveActiveUserFromSessionMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			findFirst: postFindFirstMock,
			update: postUpdateMock,
		},
	},
}));

vi.mock("@/lib/cache-tags", () => ({
	getPostMutationTags: vi.fn(() => ["post:16"]),
	parsePostTags: vi.fn(() => []),
	safeRevalidateTags: safeRevalidateTagsMock,
}));

describe("PATCH /api/posts/[id]", () => {
	beforeEach(() => {
		authMock.mockReset();
		resolveActiveUserFromSessionMock.mockReset();
		postFindFirstMock.mockReset();
		postUpdateMock.mockReset();
		safeRevalidateTagsMock.mockReset();
		authMock.mockResolvedValue({ user: { id: "5" } });
		resolveActiveUserFromSessionMock.mockResolvedValue({
			ok: true,
			context: { userId: 5, role: "user", nickname: "tester", isApproved: 1, isBanned: 0 },
		});
	});

	it("legacy board 컬럼이 없어도 신문고 수정이 tags metadata 기준으로 성공해야 함", async () => {
		postFindFirstMock
			.mockRejectedValueOnce(new Error("SQLITE_UNKNOWN: SQLite error: no such column: main.Post.board"))
			.mockResolvedValueOnce({
				id: 16,
				authorId: 5,
				tags: '["__sys:server:mc.legacy.kr","__sys:board:ombudsman"]',
			});
		postUpdateMock
			.mockRejectedValueOnce(new Error("SQLITE_UNKNOWN: SQLite error: no such column: main.Post.board"))
			.mockResolvedValueOnce({});

		const { PATCH } = await import("@/app/api/posts/[id]/route");
		const req = new Request("http://localhost/api/posts/16", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: "수정된 신문고",
				content: "수정 본문",
				board: "sinmungo",
				serverAddress: "mc.fixed.kr",
				tags: [],
			}),
		});

		const res = await PATCH(req as never, { params: Promise.resolve({ id: "16" }) });

		expect(res.status).toBe(200);
		expect(postFindFirstMock).toHaveBeenNthCalledWith(1, {
			where: {
				id: 16,
				deletedAt: null,
			},
			select: {
				id: true,
				authorId: true,
				tags: true,
				board: true,
				serverAddress: true,
			},
		});
		expect(postFindFirstMock).toHaveBeenNthCalledWith(2, {
			where: {
				id: 16,
				deletedAt: null,
			},
			select: {
				id: true,
				authorId: true,
				tags: true,
			},
		});
		expect(postUpdateMock).toHaveBeenNthCalledWith(2, {
			where: { id: 16 },
			data: {
				title: "수정된 신문고",
				content: "수정 본문",
				tags: '["__sys:server:mc.fixed.kr","__sys:board:ombudsman"]',
				updatedAt: expect.any(Date),
			},
		});
	});
});
