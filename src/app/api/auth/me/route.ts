import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { PrismaClient } from "@/generated/client";

const prisma = new PrismaClient();

/**
 * 현재 사용자 정보 API
 * GET /api/auth/me
 * 
 * 응답:
 * - user: 사용자 정보 (id, email, nickname, role, minecraftUuid, createdAt, lastAuthAt)
 */
export async function GET() {
	try {
		// NextAuth 세션 검증
		const session = await auth();

		if (!session?.user) {
			return NextResponse.json(
				{ error: "auth_error_unauthorized" },
				{ status: 401 }
			);
		}

		// 사용자 정보 조회
		const user = await prisma.user.findUnique({
			where: { id: session.user.id },
			select: {
				id: true,
				email: true,
				nickname: true,
				role: true,
				minecraftUuid: true,
				createdAt: true,
				lastAuthAt: true,
			},
		});

		if (!user) {
			return NextResponse.json(
				{ error: "auth_error_unauthorized" },
				{ status: 404 }
			);
		}

		return NextResponse.json({ user });
	} catch (error) {
		console.error("[Auth] /me error:", error);
		return NextResponse.json(
			{ error: "server_error" },
			{ status: 500 }
		);
	}
}
