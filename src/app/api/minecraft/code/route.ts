import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";


/**
 * 마인크래프트 인증 코드 생성 API
 * POST /api/minecraft/code
 * 
 * 응답:
 * - code: 7자리 숫자 코드
 */
export async function POST(req: NextRequest) {
	try {
		const rateLimitedResponse = enforceRateLimit(req, RATE_LIMIT_POLICIES.minecraftCode);
		if (rateLimitedResponse) {
			return rateLimitedResponse;
		}

		// IP 주소 추출
		const ip =
			req.headers.get("x-forwarded-for") ||
			req.headers.get("x-real-ip") ||
			"unknown";

		// 만료된 코드 정리 (10분)
		const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
		await prisma.minecraftCode.deleteMany({
			where: {
				createdAt: {
					lt: tenMinutesAgo,
				},
			},
		});

		// 랜덤 7자리 숫자 코드 생성
		const code = Math.floor(1000000 + Math.random() * 9000000).toString();

		// 코드 저장
		await prisma.minecraftCode.create({
			data: {
				code,
				ipAddress: ip,
			},
		});

		return NextResponse.json({ code });
	} catch (error) {
		console.error("[Minecraft] Code generation error:", error);
		return NextResponse.json(
			{ error: "database_error" },
			{ status: 500 }
		);
	}
}
