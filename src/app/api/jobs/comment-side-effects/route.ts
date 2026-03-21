import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import {
	getCommentSideEffectRetryDelayMs,
	isMissingCommentSideEffectJobTableError,
	runCommentSideEffects,
} from "@/lib/comment-side-effects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPT_COUNT = 4;

function toBatchSize(value: string | null): number {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return 50;
	}
	if (parsed > 100) {
		return 100;
	}
	return parsed;
}

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "";
}

async function handleDispatch(request: NextRequest) {
	if (!isAuthorizedCronRequest(request)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	try {
		const batchSize = toBatchSize(request.nextUrl.searchParams.get("batch"));
		const now = new Date();
		const candidates = await prisma.commentSideEffectJob.findMany({
			where: {
				status: "queued",
				nextAttemptAt: { lte: now },
			},
			orderBy: { createdAt: "asc" },
			take: batchSize,
			select: {
				id: true,
				commentId: true,
				postId: true,
				actorUserId: true,
				actorNickname: true,
				content: true,
				attemptCount: true,
			},
		});

		let processed = 0;
		let completed = 0;
		let retried = 0;
		let dead = 0;
		let skipped = 0;

		for (const candidate of candidates) {
			const claimed = await prisma.commentSideEffectJob.updateMany({
				where: {
					id: candidate.id,
					status: "queued",
				},
				data: {
					status: "processing",
				},
			});
			if (claimed.count === 0) {
				skipped += 1;
				continue;
			}

			processed += 1;
			const startedAt = Date.now();

			try {
				const result = await runCommentSideEffects({
					commentId: candidate.commentId,
					postId: candidate.postId,
					actorUserId: candidate.actorUserId,
					actorNickname: candidate.actorNickname,
					content: candidate.content,
				});

				await prisma.commentSideEffectJob.update({
					where: { id: candidate.id },
					data: {
						status: "done",
						lastErrorCode: null,
						lastErrorMessage: null,
					},
				});

				console.info("[comment-side-effects] job completed", {
					jobId: candidate.id,
					commentId: candidate.commentId,
					postId: candidate.postId,
					...result.durations,
					totalMs: Date.now() - startedAt,
					mentionCount: result.mentionTargets.length,
					subscriptionCount: result.subscriptionTargets.length,
				});
				completed += 1;
			} catch (error) {
				const attemptCount = candidate.attemptCount + 1;
				if (attemptCount >= MAX_ATTEMPT_COUNT) {
					await prisma.commentSideEffectJob.update({
						where: { id: candidate.id },
						data: {
							status: "done",
							attemptCount,
							lastErrorCode: "max_attempts_reached",
							lastErrorMessage: toErrorMessage(error),
						},
					});
					dead += 1;
					continue;
				}

				await prisma.commentSideEffectJob.update({
					where: { id: candidate.id },
					data: {
						status: "queued",
						attemptCount,
						nextAttemptAt: new Date(Date.now() + getCommentSideEffectRetryDelayMs(attemptCount)),
						lastErrorCode: "job_retry_scheduled",
						lastErrorMessage: toErrorMessage(error),
					},
				});
				retried += 1;
			}
		}

		return NextResponse.json({
			ok: true,
			batchSize,
			processed,
			completed,
			retried,
			dead,
			skipped,
		});
	} catch (error) {
		console.error("[API] comment side-effects dispatch error:", error);
		if (isMissingCommentSideEffectJobTableError(error)) {
			return NextResponse.json({ error: "db_schema_not_ready" }, { status: 503 });
		}
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}

export async function GET(request: NextRequest) {
	return handleDispatch(request);
}

export async function POST(request: NextRequest) {
	return handleDispatch(request);
}
