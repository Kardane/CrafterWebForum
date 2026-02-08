import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeprecationHeaders } from "@/lib/deprecation";
import { getUserProfile } from "@/lib/user-service";
import { toSessionUserId } from "@/lib/session-user";

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
				{ error: "unauthorized" },
				{ status: 401 }
			);
		}

		const userId = toSessionUserId(session.user.id);
		if (!userId) {
			return NextResponse.json(
				{ error: "unauthorized" },
				{ status: 401 }
			);
		}

		const profile = await getUserProfile(userId);
		if (!profile) {
			return NextResponse.json(
				{ error: "not_found" },
				{ status: 404 }
			);
		}

		return NextResponse.json(profile, {
			headers: getDeprecationHeaders("/api/users/me"),
		});
	} catch (error: unknown) {
		console.error("[Auth] /profile error:", error);
		return NextResponse.json(
			{ error: "internal_server_error" },
			{ status: 500 }
		);
	}
}
