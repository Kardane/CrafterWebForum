import { handlers } from "@/auth";
import { NextRequest } from "next/server";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";

// NextAuth.js API 핸들러
export const GET = handlers.GET;

export async function POST(request: NextRequest) {
	const pathname = new URL(request.url).pathname;
	if (pathname.endsWith("/callback/credentials")) {
		const rateLimited = await enforceRateLimitAsync(request, RATE_LIMIT_POLICIES.authLogin);
		if (rateLimited) {
			return rateLimited;
		}
	}

	return handlers.POST(request);
}
