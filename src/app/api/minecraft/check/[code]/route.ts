import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


/**
 * 마인크래프트 인증 상태 확인 API
 * GET /api/minecraft/check/[code]
 * 
 * 응답:
 * - verified: 인증 완료 여부
 * - nickname: 연결된 닉네임
 */
export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ code: string }> }
) {
	try {
		const { code } = await params;

		// 코드 조회
		const data = await prisma.minecraftCode.findUnique({
			where: { code },
			select: {
				isVerified: true,
				linkedNickname: true,
			},
		});

		if (!data) {
			return NextResponse.json(
				{ error: "not_found" },
				{ status: 404 }
			);
		}

		return NextResponse.json({
			verified: !!data.isVerified,
			nickname: data.linkedNickname,
		});
	} catch (error) {
		console.error("[Minecraft] Check error:", error);
		return NextResponse.json(
			{ error: "server_error" },
			{ status: 500 }
		);
	}
}
