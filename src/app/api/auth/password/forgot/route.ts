import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";
import {
	MINECRAFT_AUTH_CODE_REGEX,
	normalizeMinecraftAuthCode,
} from "@/lib/minecraft-auth-code";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";
import { text } from "@/lib/system-text";
import { z } from "zod";

const PASSWORD_REGEX = /^(?=.*[0-9!@#$%^&*])(?=.{8,})/;
const CODE_TTL_MS = 10 * 60 * 1000;
const forgotPasswordBodySchema = z.object({
	code: z.string().trim().min(1),
	newPassword: z.string().min(1),
});

/**
 * POST /api/auth/password/forgot
 * 코드 검증 기반 비밀번호 재설정
 */
export async function POST(req: NextRequest) {
	try {
		const rateLimitedResponse = await enforceRateLimitAsync(req, RATE_LIMIT_POLICIES.authPasswordForgot);
		if (rateLimitedResponse) {
			return rateLimitedResponse;
		}

		const parsedBody = forgotPasswordBodySchema.safeParse(
			await readJsonBody(req, { maxBytes: 128 * 1024 })
		);
		if (!parsedBody.success) {
			return NextResponse.json(
				{
					error: "validation_error",
					message: text("passwordReset.errorInvalidRequest"),
				},
				{ status: 400 }
			);
		}
		const normalizedCode = normalizeMinecraftAuthCode(parsedBody.data.code);
		const newPassword = parsedBody.data.newPassword;

		if (
			!normalizedCode ||
			!MINECRAFT_AUTH_CODE_REGEX.test(normalizedCode) ||
			!newPassword ||
			!PASSWORD_REGEX.test(newPassword)
		) {
			return NextResponse.json(
				{
					error: "validation_error",
					message: text("passwordReset.errorPasswordPolicy"),
				},
				{ status: 400 }
			);
		}

		const codeData = await prisma.minecraftCode.findUnique({
			where: { code: normalizedCode },
			select: {
				code: true,
				isVerified: true,
				linkedNickname: true,
				createdAt: true,
			},
		});

		// 코드 무효/미인증/만료 상태는 동일 응답으로 노출해 계정 추론을 차단
		if (
			!codeData ||
			!codeData.isVerified ||
			!codeData.linkedNickname ||
			Date.now() - codeData.createdAt.getTime() > CODE_TTL_MS
		) {
			return NextResponse.json(
				{
					error: "recovery_verification_failed",
					message: text("passwordReset.errorResetFailed"),
				},
				{ status: 400 }
			);
		}

		const targetUser = await prisma.user.findFirst({
			where: {
				nickname: codeData.linkedNickname,
				deletedAt: null,
			},
			select: {
				id: true,
			},
		});

		if (!targetUser) {
			return NextResponse.json(
				{
					error: "recovery_verification_failed",
					message: text("passwordReset.errorResetFailed"),
				},
				{ status: 400 }
			);
		}

		const hashedPassword = await hash(newPassword, 10);
		await prisma.$transaction([
			prisma.user.update({
				where: { id: targetUser.id },
				data: {
					password: hashedPassword,
					lastAuthAt: new Date(),
				},
			}),
			prisma.minecraftCode.delete({
				where: { code: normalizedCode },
			}),
		]);

		return NextResponse.json({
			success: true,
			message: text("passwordReset.successMessage"),
		});
	} catch (error: unknown) {
		if (error instanceof JsonBodyError) {
			return NextResponse.json(
				{
					error: "validation_error",
					message: text("passwordReset.errorInvalidRequest"),
				},
				{ status: 400 }
			);
		}
		console.error("[Auth] POST /api/auth/password/forgot error:", error);
		return NextResponse.json(
			{
				error: "internal_server_error",
				message: text("passwordReset.errorUnexpected"),
			},
			{ status: 500 }
		);
	}
}
