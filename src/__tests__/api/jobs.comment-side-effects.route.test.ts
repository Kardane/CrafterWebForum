import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const findManyMock = vi.fn();
const updateManyMock = vi.fn();
const updateMock = vi.fn();
const runCommentSideEffectsMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
	prisma: {
		commentSideEffectJob: {
			findMany: findManyMock,
			updateMany: updateManyMock,
			update: updateMock,
		},
	},
}));

vi.mock("@/lib/comment-side-effects", () => ({
	getCommentSideEffectRetryDelayMs: vi.fn(() => 15_000),
	isMissingCommentSideEffectJobTableError: vi.fn((error: unknown) =>
		String(error).toLowerCase().includes("commentsideeffectjob")
	),
	runCommentSideEffects: runCommentSideEffectsMock,
}));

describe("POST /api/jobs/comment-side-effects", () => {
	beforeEach(() => {
		findManyMock.mockReset();
		updateManyMock.mockReset();
		updateMock.mockReset();
		runCommentSideEffectsMock.mockReset();
		process.env.CRON_SECRET = "secret";
		updateManyMock.mockResolvedValue({ count: 1 });
		updateMock.mockResolvedValue({});
	});

	it("returns 401 without cron authorization", async () => {
		const { POST } = await import("@/app/api/jobs/comment-side-effects/route");
		const req = new NextRequest("http://localhost/api/jobs/comment-side-effects", { method: "POST" });
		const res = await POST(req);
		expect(res.status).toBe(401);
	});

	it("returns 503 when CommentSideEffectJob table is missing", async () => {
		findManyMock.mockRejectedValue(new Error("SQLITE_UNKNOWN: SQLite error: no such table: main.CommentSideEffectJob"));

		const { POST } = await import("@/app/api/jobs/comment-side-effects/route");
		const req = new NextRequest("http://localhost/api/jobs/comment-side-effects", {
			method: "POST",
			headers: { authorization: "Bearer secret" },
		});
		const res = await POST(req);

		expect(res.status).toBe(503);
		await expect(res.json()).resolves.toEqual({ error: "db_schema_not_ready" });
	});

	it("processes queued side effect jobs and marks them done", async () => {
		findManyMock.mockResolvedValue([
			{
				id: 1,
				commentId: 101,
				postId: 12,
				actorUserId: 10,
				actorNickname: "actor",
				content: "@alice hi",
				attemptCount: 0,
			},
		]);
		runCommentSideEffectsMock.mockResolvedValue({
			mentionTargets: [{ id: 20, nickname: "alice" }],
			subscriptionTargets: [{ id: 30, nickname: "watcher" }],
			durations: {
				load_targets: 4,
				create_notifications: 8,
				queue_deliveries: 3,
				broadcast: 1,
			},
		});

		const { POST } = await import("@/app/api/jobs/comment-side-effects/route");
		const req = new NextRequest("http://localhost/api/jobs/comment-side-effects?batch=10", {
			method: "POST",
			headers: { authorization: "Bearer secret" },
		});
		const res = await POST(req);
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(runCommentSideEffectsMock).toHaveBeenCalledWith({
			commentId: 101,
			postId: 12,
			actorUserId: 10,
			actorNickname: "actor",
			content: "@alice hi",
		});
		expect(updateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 1 },
				data: expect.objectContaining({
					status: "done",
					lastErrorCode: null,
				}),
			})
		);
		expect(body).toEqual({
			ok: true,
			batchSize: 10,
			processed: 1,
			completed: 1,
			retried: 0,
			dead: 0,
			skipped: 0,
		});
	});

	it("requeues failed jobs with backoff", async () => {
		findManyMock.mockResolvedValue([
			{
				id: 1,
				commentId: 101,
				postId: 12,
				actorUserId: 10,
				actorNickname: "actor",
				content: "@alice hi",
				attemptCount: 0,
			},
		]);
		runCommentSideEffectsMock.mockRejectedValue(new Error("temporary failure"));

		const { POST } = await import("@/app/api/jobs/comment-side-effects/route");
		const req = new NextRequest("http://localhost/api/jobs/comment-side-effects", {
			method: "POST",
			headers: { authorization: "Bearer secret" },
		});
		const res = await POST(req);
		const body = await res.json();

		expect(res.status).toBe(200);
		expect(updateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 1 },
				data: expect.objectContaining({
					status: "queued",
					attemptCount: 1,
					lastErrorCode: "job_retry_scheduled",
					lastErrorMessage: "temporary failure",
				}),
			})
		);
		expect(body).toEqual({
			ok: true,
			batchSize: 50,
			processed: 1,
			completed: 0,
			retried: 1,
			dead: 0,
			skipped: 0,
		});
	});
});
