import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDeprecationHeaders } from "@/lib/deprecation";
import { changeUserPassword } from "@/lib/user-service";

/**
 * 비밀번호 변경 API
 * PUT /api/auth/password
 * 
 * 요청 본문:
 * - currentPassword: 현재 비밀번호
 * - newPassword: 새 비밀번호 (8자 이상)
 */
export async function PUT(req: NextRequest) {
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
			currentPassword?: unknown;
			newPassword?: unknown;
		};
		const result = await changeUserPassword(
			session.user.id,
			body.currentPassword,
			body.newPassword
		);

		if (!result.ok) {
			if (result.reason === "validation_error") {
				return NextResponse.json(
					{ error: "validation_error" },
					{ status: 400 }
				);
			}

			if (result.reason === "wrong_password") {
				return NextResponse.json(
					{ error: "wrong_password" },
					{ status: 400 }
				);
			}

			return NextResponse.json(
				{ error: "not_found" },
				{ status: 404 }
			);
		}

		return NextResponse.json(
			{
				success: true,
				message: "password_updated",
			},
			{
				headers: getDeprecationHeaders("/api/users/me/password"),
			}
		);
	} catch (error: unknown) {
		console.error("[Auth] /password error:", error);
		return NextResponse.json(
			{ error: "internal_server_error" },
			{ status: 500 }
		);
	}
}
