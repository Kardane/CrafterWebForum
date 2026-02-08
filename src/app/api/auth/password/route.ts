import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { compare, hash } from "bcryptjs";
import { PrismaClient } from "@/generated/client";

const prisma = new PrismaClient();

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
				{ error: "auth_error_unauthorized" },
				{ status: 401 }
			);
		}

		const body = await req.json();
		const { currentPassword, newPassword } = body;

		// 필수 필드 검증
		if (!currentPassword || !newPassword) {
			return NextResponse.json(
				{ error: "validation_error_required" },
				{ status: 400 }
			);
		}

		// 새 비밀번호 길이 검증
		if (newPassword.length < 8) {
			return NextResponse.json(
				{ error: "validation_error_password" },
				{ status: 400 }
			);
		}

		// 사용자 조회 (비밀번호 포함)
		const user = await prisma.user.findUnique({
			where: { id: session.user.id },
			select: {
				id: true,
				nickname: true,
				password: true,
			},
		});

		if (!user) {
			return NextResponse.json(
				{ error: "auth_error_unauthorized" },
				{ status: 404 }
			);
		}

		// 현재 비밀번호 검증
		const isValidPassword = await compare(currentPassword, user.password);
		if (!isValidPassword) {
			return NextResponse.json(
				{ error: "profile_error_wrong_password" },
				{ status: 401 }
			);
		}

		// 새 비밀번호 해싱
		const hashedPassword = await hash(newPassword, 10);

		// 비밀번호 업데이트
		await prisma.user.update({
			where: { id: user.id },
			data: { password: hashedPassword },
		});

		console.log(
			`[Auth] Password Changed: ${user.nickname} (ID: ${user.id})`
		);

		return NextResponse.json({
			success: true,
			message: "profile_success_password",
		});
	} catch (error) {
		console.error("[Auth] /password error:", error);
		return NextResponse.json(
			{ error: "server_error" },
			{ status: 500 }
		);
	}
}
