import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminMock = vi.fn();
const postFindFirstMock = vi.fn();
const postUpdateMock = vi.fn();
const postDeleteMock = vi.fn();
const safeRevalidateTagsMock = vi.fn();

vi.mock("@/lib/admin-auth", () => ({
	requireAdmin: requireAdminMock,
}));

vi.mock("@/lib/prisma", () => ({
	prisma: {
		post: {
			findFirst: postFindFirstMock,
			update: postUpdateMock,
			delete: postDeleteMock,
		},
	},
}));

vi.mock("@/lib/cache-tags", () => ({
	getPostMutationTags: vi.fn(() => ["post:1"]),
	parsePostTags: vi.fn(() => []),
	safeRevalidateTags: safeRevalidateTagsMock,
}));

describe("/api/admin/posts/[id]", () => {
	beforeEach(() => {
		requireAdminMock.mockReset();
		postFindFirstMock.mockReset();
		postUpdateMock.mockReset();
		postDeleteMock.mockReset();
		safeRevalidateTagsMock.mockReset();
		vi.restoreAllMocks();
		requireAdminMock.mockResolvedValue({
			session: { user: { id: "1", role: "admin" } },
		});
	});

	it("DELETE는 legacy schema에서도 안전한 select로 포스트를 읽고 아카이브해야 함", async () => {
		postFindFirstMock.mockResolvedValue({
			id: 11,
			tags: '["__sys:server:mc.sinmungo.kr","__sys:board:ombudsman"]',
			deletedAt: null,
		});
		postUpdateMock.mockResolvedValue({});

		const { DELETE } = await import("@/app/api/admin/posts/[id]/route");
		const req = new Request("http://localhost/api/admin/posts/11", {
			method: "DELETE",
		});

		const res = await DELETE(req, { params: Promise.resolve({ id: "11" }) });

		expect(res.status).toBe(200);
		expect(postFindFirstMock).toHaveBeenCalledWith({
			where: { id: 11 },
			select: {
				id: true,
				tags: true,
				deletedAt: true,
			},
		});
		expect(postUpdateMock).toHaveBeenCalledWith({
			where: { id: 11 },
			data: { deletedAt: expect.any(Date) },
			select: { id: true },
		});
	});

	it("PATCH restore도 legacy schema에서도 안전한 select로 포스트를 읽어야 함", async () => {
		postFindFirstMock.mockResolvedValue({
			id: 12,
			tags: '["__sys:server:mc.sinmungo.kr","__sys:board:ombudsman"]',
			deletedAt: new Date("2026-03-23T00:00:00.000Z"),
		});
		postUpdateMock.mockResolvedValue({});

		const { PATCH } = await import("@/app/api/admin/posts/[id]/route");
		const req = new Request("http://localhost/api/admin/posts/12", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "restore" }),
		});

		const res = await PATCH(req, { params: Promise.resolve({ id: "12" }) });

		expect(res.status).toBe(200);
		expect(postFindFirstMock).toHaveBeenCalledWith({
			where: { id: 12 },
			select: {
				id: true,
				tags: true,
				deletedAt: true,
			},
		});
		expect(postUpdateMock).toHaveBeenCalledWith({
			where: { id: 12 },
			data: { deletedAt: null },
			select: { id: true },
		});
	});

	it("DELETE permanent도 legacy schema에서도 full row materialize 없이 삭제해야 함", async () => {
		postFindFirstMock.mockResolvedValue({
			id: 13,
			tags: '["__sys:server:mc.sinmungo.kr","__sys:board:ombudsman"]',
			deletedAt: new Date("2026-03-23T00:00:00.000Z"),
		});
		postDeleteMock.mockResolvedValue({ id: 13 });

		const { DELETE } = await import("@/app/api/admin/posts/[id]/route");
		const req = new Request("http://localhost/api/admin/posts/13?permanent=true", {
			method: "DELETE",
		});

		const res = await DELETE(req, { params: Promise.resolve({ id: "13" }) });

		expect(res.status).toBe(200);
		expect(postDeleteMock).toHaveBeenCalledWith({
			where: { id: 13 },
			select: { id: true },
		});
	});

	it("DELETE archive 실패 시 stage 로그를 남겨야 함", async () => {
		const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		postFindFirstMock.mockResolvedValue({
			id: 14,
			tags: '["__sys:server:mc.sinmungo.kr","__sys:board:ombudsman"]',
			deletedAt: null,
		});
		postUpdateMock.mockRejectedValue(new Error("archive write failed"));

		const { DELETE } = await import("@/app/api/admin/posts/[id]/route");
		const req = new Request("http://localhost/api/admin/posts/14", {
			method: "DELETE",
		});

		const res = await DELETE(req, { params: Promise.resolve({ id: "14" }) });
		const data = (await res.json()) as { error?: string };

		expect(res.status).toBe(500);
		expect(data.error).toBe("Internal server error");
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"[API] DELETE /api/admin/posts/[id] error stage=archive:",
			expect.any(Error)
		);
	});
});
