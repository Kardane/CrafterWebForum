import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
	buildDeliveryDedupeKey,
	ensureWebPushConfigured,
	getNotificationTargetUrl,
	getRetryDelayMs,
	sendWebPush,
} from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPT_COUNT = 5;

function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "";
}

function isMissingDeliveryTableError(error: unknown): boolean {
	const message = toErrorMessage(error).toLowerCase();
	return (
		message.includes("no such table: main.notificationdelivery") ||
		message.includes("table `main.notificationdelivery` does not exist") ||
		message.includes("notificationdelivery") && message.includes("no such table")
	);
}

function toBatchSize(value: string | null): number {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return 50;
	}
	if (parsed > 200) {
		return 200;
	}
	return parsed;
}

function isAuthorizedCron(request: NextRequest): boolean {
	const cronSecret = (process.env.CRON_SECRET ?? "").trim();
	if (!cronSecret) {
		return false;
	}
	const authorization = request.headers.get("authorization") ?? "";
	const expected = `Bearer ${cronSecret}`;
	const authDigest = createHash("sha256").update(authorization).digest();
	const expectedDigest = createHash("sha256").update(expected).digest();
	return timingSafeEqual(authDigest, expectedDigest);
}

async function handleDispatch(request: NextRequest) {
	if (!isAuthorizedCron(request)) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	try {
		ensureWebPushConfigured();
	} catch {
		return NextResponse.json({ error: "push_env_not_configured" }, { status: 500 });
	}

	try {
		const batchSize = toBatchSize(request.nextUrl.searchParams.get("batch"));
		const now = new Date();
		const candidates = await prisma.notificationDelivery.findMany({
			where: {
				channel: "web_push",
				status: "queued",
				nextAttemptAt: { lte: now },
			},
			orderBy: { createdAt: "asc" },
			take: batchSize,
			include: {
				notification: {
					select: {
						id: true,
						type: true,
						postId: true,
						commentId: true,
					},
				},
				subscription: {
					select: {
						id: true,
						endpoint: true,
						p256dh: true,
						auth: true,
						isActive: true,
					},
				},
			},
		});

		let processed = 0;
		let sent = 0;
		let retried = 0;
		let dead = 0;
		let skipped = 0;

		for (const candidate of candidates) {
			const claimed = await prisma.notificationDelivery.updateMany({
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
			const subscription = candidate.subscription;
			if (!subscription || subscription.isActive !== 1) {
				await prisma.notificationDelivery.update({
					where: { id: candidate.id },
					data: {
						status: "dead",
						lastErrorCode: "inactive_subscription",
						lastErrorMessage: "Push subscription is inactive or missing",
					},
				});
				dead += 1;
				continue;
			}

			const payload = JSON.stringify({
				notificationId: candidate.notification.id,
				type: candidate.notification.type,
				targetUrl: getNotificationTargetUrl({
					postId: candidate.notification.postId,
					commentId: candidate.notification.commentId,
				}),
				title: "새 알림",
				body: "새 알림이 도착했음",
			});

			const sendResult = await sendWebPush(
				{
					endpoint: subscription.endpoint,
					keys: {
						p256dh: subscription.p256dh,
						auth: subscription.auth,
					},
				},
				payload
			);

			if (sendResult.ok) {
				await prisma.notificationDelivery.update({
					where: { id: candidate.id },
					data: {
						status: "sent",
						sentAt: new Date(),
						lastErrorCode: null,
						lastErrorMessage: null,
					},
				});
				sent += 1;
				continue;
			}

			const isGone = sendResult.statusCode === 404 || sendResult.statusCode === 410;
			if (isGone) {
				await prisma.$transaction([
					prisma.pushSubscription.update({
						where: { id: subscription.id },
						data: { isActive: 0 },
					}),
					prisma.notificationDelivery.update({
						where: { id: candidate.id },
						data: {
							status: "dead",
							lastErrorCode: `http_${String(sendResult.statusCode ?? "unknown")}`,
							lastErrorMessage: sendResult.message,
						},
					}),
				]);
				dead += 1;
				continue;
			}

			const attemptCount = candidate.attemptCount + 1;
			if (attemptCount >= MAX_ATTEMPT_COUNT) {
				await prisma.notificationDelivery.update({
					where: { id: candidate.id },
					data: {
						status: "dead",
						attemptCount,
						lastErrorCode: `http_${String(sendResult.statusCode ?? "unknown")}`,
						lastErrorMessage: sendResult.message,
					},
				});
				dead += 1;
				continue;
			}

			await prisma.notificationDelivery.update({
				where: { id: candidate.id },
				data: {
					status: "queued",
					attemptCount,
					nextAttemptAt: new Date(Date.now() + getRetryDelayMs(attemptCount)),
					lastErrorCode: `http_${String(sendResult.statusCode ?? "unknown")}`,
					lastErrorMessage: sendResult.message,
					dedupeKey: buildDeliveryDedupeKey(candidate.notificationId, candidate.channel, candidate.subscriptionId),
				},
			});
			retried += 1;
		}

		return NextResponse.json({
			ok: true,
			batchSize,
			processed,
			sent,
			retried,
			dead,
			skipped,
		});
	} catch (error) {
		console.error("[API] POST /api/jobs/push-dispatch error:", error);
		if (isMissingDeliveryTableError(error)) {
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
