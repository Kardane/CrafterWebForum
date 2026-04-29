import { SignJWT } from "jose";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActiveUserFromSession } from "@/lib/active-user";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";

const REALTIME_TOKEN_TTL_SECONDS = 10 * 60;
const PLACEHOLDER_JWT_SECRET = "replace-with-realtime-jwt-secret";

export const dynamic = "force-dynamic";

function getJwtSecret() {
	const secret = process.env.REALTIME_JWT_SECRET?.trim();
	if (!secret || secret === PLACEHOLDER_JWT_SECRET) {
		return null;
	}
	return new TextEncoder().encode(secret);
}

export async function GET(request: NextRequest) {
	try {
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session);
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}

		const sessionUserId = activeUser.context.userId;
		const rateLimited = await enforceRateLimitAsync(
			request,
			RATE_LIMIT_POLICIES.realtimeToken,
			`user:${sessionUserId}`
		);
		if (rateLimited) {
			return rateLimited;
		}

		const jwtSecret = getJwtSecret();
		if (!jwtSecret) {
			return NextResponse.json({ error: "realtime_unavailable" }, { status: 500 });
		}

		const token = await new SignJWT({
			userId: sessionUserId,
			role: activeUser.context.role,
		})
			.setProtectedHeader({ alg: "HS256", typ: "JWT" })
			.setSubject(String(sessionUserId))
			.setIssuedAt()
			.setExpirationTime(`${REALTIME_TOKEN_TTL_SECONDS}s`)
			.sign(jwtSecret);

		return NextResponse.json({
			token,
			expiresIn: REALTIME_TOKEN_TTL_SECONDS,
		});
	} catch (error) {
		console.error("[API] GET /api/realtime/token error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
