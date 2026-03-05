import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";
import { parsePushSubscriptionPayloadAsync } from "@/lib/push";
import { resolveActiveUserFromSession } from "@/lib/active-user";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	try {
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session, { requireApproved: false });
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}
		const sessionUserId = activeUser.context.userId;
		const rateLimited = await enforceRateLimitAsync(request, RATE_LIMIT_POLICIES.pushSubscribe, `user:${sessionUserId}`);
		if (rateLimited) {
			return rateLimited;
		}

		const subscriptions = await prisma.pushSubscription.findMany({
			where: {
				userId: sessionUserId,
				isActive: 1,
			},
			orderBy: { updatedAt: "desc" },
			take: 20,
			select: {
				id: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		return NextResponse.json({ subscriptions });
	} catch (error) {
		console.error("[API] GET /api/push/subscribe error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session, { requireApproved: false });
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}
		const sessionUserId = activeUser.context.userId;
		const rateLimited = await enforceRateLimitAsync(request, RATE_LIMIT_POLICIES.pushSubscribe, `user:${sessionUserId}`);
		if (rateLimited) {
			return rateLimited;
		}

		const rawBody = await readJsonBody(request, { maxBytes: 256 * 1024 });
		const payload = await parsePushSubscriptionPayloadAsync(rawBody);
		if (!payload) {
			return NextResponse.json({ error: "invalid_subscription_payload" }, { status: 400 });
		}

		const existing = await prisma.pushSubscription.findUnique({
			where: { endpoint: payload.endpoint },
			select: { userId: true },
		});
		if (existing && existing.userId !== sessionUserId) {
			return NextResponse.json({ error: "endpoint_already_registered" }, { status: 409 });
		}

		await prisma.pushSubscription.upsert({
			where: { endpoint: payload.endpoint },
			update: {
				userId: sessionUserId,
				p256dh: payload.keys.p256dh,
				auth: payload.keys.auth,
				userAgent: request.headers.get("user-agent")?.slice(0, 255) ?? null,
				isActive: 1,
			},
			create: {
				userId: sessionUserId,
				endpoint: payload.endpoint,
				p256dh: payload.keys.p256dh,
				auth: payload.keys.auth,
				userAgent: request.headers.get("user-agent")?.slice(0, 255) ?? null,
				isActive: 1,
			},
		});

		return NextResponse.json({ ok: true });
	} catch (error) {
		if (error instanceof JsonBodyError) {
			return NextResponse.json({ error: error.code }, { status: error.status });
		}
		console.error("[API] POST /api/push/subscribe error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
