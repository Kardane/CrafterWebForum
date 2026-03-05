import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";
import { resolveActiveUserFromSession } from "@/lib/active-user";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";
import { assertSafeHttpUrl } from "@/lib/network-guard";
import { z } from "zod";

export const dynamic = "force-dynamic";

const unsubscribeBodySchema = z.object({
	endpoint: z.string().trim().min(1),
});

export async function POST(request: NextRequest) {
	try {
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session, { requireApproved: false });
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}
		const sessionUserId = activeUser.context.userId;
		const rateLimited = await enforceRateLimitAsync(request, RATE_LIMIT_POLICIES.pushUnsubscribe, `user:${sessionUserId}`);
		if (rateLimited) {
			return rateLimited;
		}

		const parsedBody = unsubscribeBodySchema.safeParse(
			await readJsonBody(request, { maxBytes: 64 * 1024 })
		);
		if (!parsedBody.success) {
			return NextResponse.json({ error: "invalid_endpoint" }, { status: 400 });
		}
		const endpoint = parsedBody.data.endpoint;
		try {
			await assertSafeHttpUrl(new URL(endpoint));
		} catch {
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
		if (error instanceof JsonBodyError) {
			return NextResponse.json({ error: error.code }, { status: error.status });
		}
		console.error("[API] POST /api/push/unsubscribe error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
