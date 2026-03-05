import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";

/**
 * 마인크래프트 플러그인 상태 확인 API
 * GET /api/minecraft/status
 *
 * - 플러그인 /forum status 용도
 * - Redirect/정규화 이슈 없이 200 응답을 주는 게 목표
 */
export async function GET(req: NextRequest) {
	try {
		const rateLimitedResponse = await enforceRateLimitAsync(req, RATE_LIMIT_POLICIES.minecraftStatus);
		if (rateLimitedResponse) {
			return rateLimitedResponse;
		}

		let db: "ok" | "error" = "ok";
		try {
			// 가벼운 쿼리로 DB 생존성만 확인
			await prisma.minecraftCode.count();
		} catch {
			db = "error";
		}

		return NextResponse.json(
			{ ok: true, db },
			{
				status: 200,
				headers: {
					"Cache-Control": "no-store",
				},
			}
		);
	} catch (error: unknown) {
		console.error("[Minecraft] Status error:", error);
		return NextResponse.json(
			{ ok: true, db: "error" },
			{
				status: 200,
				headers: {
					"Cache-Control": "no-store",
				},
			}
		);
	}
}
