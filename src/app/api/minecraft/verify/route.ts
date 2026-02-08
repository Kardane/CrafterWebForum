import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/client";

const prisma = new PrismaClient();

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
		const body = await req.json();
		const { code, uuid, nickname, ip } = body;

		console.log("[Minecraft] Verify Request:", body);

		// 필수 필드 검증
		if (!code || !uuid || !nickname || !ip) {
			console.error("[Minecraft] Missing params:", body);
			return NextResponse.json(
				{ error: "missing_params" },
				{ status: 400 }
			);
		}

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

		// IP 검증 로그
		console.log(
			`[Minecraft] IP Check: Web(${authRequest.ipAddress}) vs MC(${ip})`
		);

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
		console.error("[Minecraft] Verify error:", error);
		return NextResponse.json(
			{ error: "db_error" },
			{ status: 500 }
		);
	}
}
