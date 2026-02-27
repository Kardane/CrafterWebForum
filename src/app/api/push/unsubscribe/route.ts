import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toSessionUserId } from "@/lib/session-user";
import { enforceRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";

export const dynamic = "force-dynamic";

function toEndpoint(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const endpoint = value.trim();
	if (!endpoint) {
		return null;
	}
	return endpoint;
}

export async function POST(request: NextRequest) {
	const rateLimited = enforceRateLimit(request, RATE_LIMIT_POLICIES.pushUnsubscribe);
	if (rateLimited) {
		return rateLimited;
	}

	try {
		const session = await auth();
		const sessionUserId = toSessionUserId(session?.user?.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		}

		const body = (await request.json()) as { endpoint?: unknown };
		const endpoint = toEndpoint(body.endpoint);
		if (!endpoint) {
			return NextResponse.json({ error: "invalid_endpoint" }, { status: 400 });
		}

		await prisma.pushSubscription.updateMany({
			where: {
				userId: sessionUserId,
				endpoint,
			},
			data: {
				isActive: 0,
			},
		});

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("[API] POST /api/push/unsubscribe error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
