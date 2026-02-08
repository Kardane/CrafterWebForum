import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeprecationHeaders } from "@/lib/deprecation";
import { updateMinecraftIdentity } from "@/lib/user-service";

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
				{ error: "unauthorized" },
				{ status: 401 }
			);
		}

		const body = await req.json() as {
			nickname?: unknown;
			uuid?: unknown;
		};
		const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
		const uuid = typeof body.uuid === "string" ? body.uuid.trim() : "";

		// 필수 필드 검증
		if (!nickname || !uuid) {
			return NextResponse.json(
				{ error: "validation_error" },
				{ status: 400 }
			);
		}

		const result = await updateMinecraftIdentity(session.user.id, nickname, uuid);
		return NextResponse.json(
			{
				success: true,
				last_auth_at: result.lastAuthAt,
			},
			{
				headers: getDeprecationHeaders("/api/users/me/minecraft-reauth"),
			}
		);
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
				{ error: "conflict" },
				{ status: 400 }
			);
		}

		return NextResponse.json(
			{ error: "internal_server_error" },
			{ status: 500 }
		);
	}
}
