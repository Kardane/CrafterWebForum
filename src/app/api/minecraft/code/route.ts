import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";
import {
	generateMinecraftAuthCode,
	MINECRAFT_SIGNUP_CODE_LENGTH,
} from "@/lib/minecraft-auth-code";

/**
 * 마인크래프트 인증 코드 생성 API
 * POST /api/minecraft/code
 * 
 * 응답:
 * - code: 7자리 영문/숫자 코드
 */
export async function POST(req: NextRequest) {
	try {
		const rateLimitedResponse = await enforceRateLimitAsync(req, RATE_LIMIT_POLICIES.minecraftCode);
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
	
		// 랜덤 코드 생성 + 저장 (충돌 시 재시도)
		const maxRetry = 8;
		for (let attempt = 0; attempt < maxRetry; attempt += 1) {
			const code = generateMinecraftAuthCode(MINECRAFT_SIGNUP_CODE_LENGTH);
			try {
				await prisma.minecraftCode.create({
					data: {
						code,
						ipAddress: ip,
					},
				});
				return NextResponse.json({ code });
			} catch (error: unknown) {
				const isUniqueViolation =
					typeof error === "object" &&
					error !== null &&
					"code" in error &&
					error.code === "P2002";
				if (!isUniqueViolation) {
					throw error;
				}
			}
		}
	
		return NextResponse.json(
			{ error: "code_generation_failed" },
			{ status: 500 }
		);
	} catch (error) {
		console.error("[Minecraft] Code generation error:", error);
		return NextResponse.json(
			{ error: "database_error" },
			{ status: 500 }
		);
	}
}
