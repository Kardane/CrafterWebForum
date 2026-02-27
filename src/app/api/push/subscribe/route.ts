import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toSessionUserId } from "@/lib/session-user";
import { enforceRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";
import { parsePushSubscriptionPayload } from "@/lib/push";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const rateLimited = enforceRateLimit(request, RATE_LIMIT_POLICIES.pushSubscribe);
	if (rateLimited) {
		return rateLimited;
	}

	try {
		const session = await auth();
		const sessionUserId = toSessionUserId(session?.user?.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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
	const rateLimited = enforceRateLimit(request, RATE_LIMIT_POLICIES.pushSubscribe);
	if (rateLimited) {
		return rateLimited;
	}

	try {
		const session = await auth();
		const sessionUserId = toSessionUserId(session?.user?.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		}

		const payload = parsePushSubscriptionPayload(await request.json());
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
		console.error("[API] POST /api/push/subscribe error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
