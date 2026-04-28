import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";
import {
	MINECRAFT_AUTH_CODE_REGEX,
	normalizeMinecraftAuthCode,
} from "@/lib/minecraft-auth-code";
import { authorizeMinecraftVerifyRequest } from "@/lib/minecraft-verify-auth";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";
import { z } from "zod";

export const runtime = "nodejs";

const verifyBodySchema = z.object({
	code: z
		.string()
		.transform((value) => normalizeMinecraftAuthCode(value))
		.refine((value) => MINECRAFT_AUTH_CODE_REGEX.test(value), {
			message: "invalid_code_format",
		}),
	uuid: z.string().trim().min(1, { message: "missing_uuid" }),
	nickname: z.string().trim().min(1, { message: "missing_nickname" }).max(32),
	// IP mismatch 체크는 비활성화, 로깅/디버깅용으로만 받음
	ip: z.string().trim().max(128).optional(),
});

/**
 * 마인크래프트 코드 검증 API
 * POST /api/minecraft/verify
 * 
 * 요청 본문:
 * - code: 인증 코드
 * - uuid: 마인크래프트 UUID
 * - nickname: 마인크래프트 닉네임
 * - ip: 서버 IP
 */
export async function POST(req: NextRequest) {
	try {
		const rateLimitedResponse = await enforceRateLimitAsync(req, RATE_LIMIT_POLICIES.minecraftVerify);
		if (rateLimitedResponse) {
			return rateLimitedResponse;
		}

		const authResult = await authorizeMinecraftVerifyRequest(req);
		if (!authResult.ok) {
			return NextResponse.json(
				{ error: authResult.error },
				{ status: authResult.status }
			);
		}

		const body = await readJsonBody(req, { maxBytes: 128 * 1024 });
		const parsed = verifyBodySchema.safeParse(body);
		if (!parsed.success) {
			return NextResponse.json(
				{ error: "missing_params" },
				{ status: 400 }
			);
		}

		const { code, uuid, nickname } = parsed.data;

		// 만료된 코드 삭제 (10분)
		const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
		await prisma.minecraftCode.deleteMany({
			where: {
				createdAt: {
					lt: tenMinutesAgo,
				},
			},
		});

		// 코드 확인
		const authRequest = await prisma.minecraftCode.findUnique({
			where: { code },
		});

		if (!authRequest) {
			return NextResponse.json(
				{ error: "invalid_code" },
				{ status: 400 }
			);
		}

		// 코드 상태를 verified로 업데이트
		await prisma.minecraftCode.update({
			where: { code },
			data: {
				isVerified: 1,
				linkedNickname: nickname,
				linkedUuid: uuid,
			},
		});

		return NextResponse.json({
			success: true,
			message: "verified",
		});
	} catch (error) {
		if (error instanceof JsonBodyError) {
			return NextResponse.json(
				{ error: "missing_params" },
				{ status: 400 }
			);
		}
		console.error("[Minecraft] Verify error:", error);
		return NextResponse.json(
			{ error: "db_error" },
			{ status: 500 }
		);
	}
}
