import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { PrismaClient } from "@/generated/client";

const prisma = new PrismaClient();

/**
 * 사용자 프로필 정보 API
 * GET /api/auth/profile
 * 
 * 응답:
 * - user: 기본 정보
 * - stats: 게시글 수, 댓글 수
 * - last_auth_at: 최근 접속 시각
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

		// 게시글 수 조회
		const postCount = await prisma.post.count({
			where: {
				authorId: session.user.id,
				deletedAt: null,
			},
		});

		// 댓글 수 조회
		const commentCount = await prisma.comment.count({
			where: {
				authorId: session.user.id,
			},
		});

		return NextResponse.json({
			user,
			stats: {
				posts: postCount,
				comments: commentCount,
			},
			last_auth_at: user.lastAuthAt,
		});
	} catch (error) {
		console.error("[Auth] /profile error:", error);
		return NextResponse.json(
			{ error: "server_error" },
			{ status: 500 }
		);
	}
}
