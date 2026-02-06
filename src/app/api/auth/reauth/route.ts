import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PrismaClient } from "@/generated/client";

const prisma = new PrismaClient();

/**
 * 마인크래프트 재인증 API
 * POST /api/auth/reauth
 * 
 * 요청 본문:
 * - nickname: 새 닉네임
 * - uuid: 마인크래프트 UUID
 */
export async function POST(req: NextRequest) {
	try {
		// NextAuth 세션 검증
		const session = await auth();

		if (!session?.user) {
			return NextResponse.json(
				{ error: "auth_error_unauthorized" },
				{ status: 401 }
			);
		}

		const body = await req.json();
		const { nickname, uuid } = body;

		// 필수 필드 검증
		if (!nickname || !uuid) {
			return NextResponse.json(
				{ error: "validation_error_required" },
				{ status: 400 }
			);
		}

		console.log(
			`[Auth] Reauth Requested for ${session.user.nickname} -> ${nickname} (UUID: ${uuid})`
		);

		// 닉네임/UUID 업데이트
		const result = await prisma.user.update({
			where: { id: session.user.id },
			data: {
				nickname,
				minecraftNickname: nickname,
				minecraftUuid: uuid,
				lastAuthAt: new Date(),
			},
			select: {
				lastAuthAt: true,
			},
		});

		console.log(
			`[Auth] Reauth Success: New Timestamp: ${result.lastAuthAt}`
		);

		return NextResponse.json({
			success: true,
			last_auth_at: result.lastAuthAt,
		});
	} catch (error: unknown) {
		console.error("[Auth] Reauth Error:", error);

		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "P2002"
		) {
			// Prisma unique constraint violation
			return NextResponse.json(
				{ error: "auth_error_exists" },
				{ status: 400 }
			);
		}

		return NextResponse.json(
			{ error: "db_error" },
			{ status: 500 }
		);
	}
}
