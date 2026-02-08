import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";


/**
 * 회원가입 API
 * POST /api/auth/register
 * 
 * 요청 본문:
 * - nickname: 닉네임
 * - password: 비밀번호 (8자 이상, 숫자/특수문자 포함)
 * - code: 마인크래프트 인증 코드
 * - signupNote: 가입 메모 (선택)
 */
export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { nickname, password, code, signupNote } = body;

		// 필수 필드 검증
		if (!code) {
			return NextResponse.json(
				{ message: "인증 코드가 필요합니다." },
				{ status: 400 }
			);
		}

		if (!nickname || !password) {
			return NextResponse.json(
				{ message: "모든 필드를 입력해주세요." },
				{ status: 400 }
			);
		}

		// 비밀번호 규칙: 8자 이상, 숫자나 특수문자 포함
		const pwRegex = /^(?=.*[0-9!@#$%^&*])(?=.{8,})/;
		if (!pwRegex.test(password)) {
			return NextResponse.json(
				{ message: "비밀번호는 8자 이상이며, 숫자나 특수문자를 포함해야 합니다." },
				{ status: 400 }
			);
		}

		// 1. 코드 검증 확인
		const codeData = await prisma.minecraftCode.findUnique({
			where: { code },
		});

		if (!codeData) {
			return NextResponse.json(
				{ message: "유효하지 않거나 만료된 코드입니다." },
				{ status: 400 }
			);
		}

		if (!codeData.isVerified) {
			return NextResponse.json(
				{ message: "아직 마인크래프트 인증이 완료되지 않았습니다." },
				{ status: 400 }
			);
		}

		// 닉네임 일치 여부 확인
		if (codeData.linkedNickname !== nickname) {
			return NextResponse.json(
				{ message: "닉네임이 불일치합니다." },
				{ status: 400 }
			);
		}

		// 비밀번호 해싱
		const hashedPassword = await hash(password, 10);

		// 가짜 이메일 생성
		const dummyEmail = `${nickname}@crafter.local`;

		// DB 저장 (isApproved = 0, signupNote 저장)
		await prisma.user.create({
			data: {
				email: dummyEmail,
				nickname,
				password: hashedPassword,
				minecraftUuid: codeData.linkedUuid || undefined,
				minecraftNickname: nickname,
				emailVerified: 1,
				lastAuthAt: new Date(),
				isApproved: 0,
				signupNote: signupNote || "",
			},
		});

		// 코드 삭제
		await prisma.minecraftCode.delete({
			where: { code },
		});

		console.log(
			`[Auth] User Registered (Pending): ${nickname} (UUID: ${codeData.linkedUuid})`
		);

		return NextResponse.json(
			{ message: "회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다." },
			{ status: 201 }
		);
	} catch (error: unknown) {
		console.error("[Auth] Registration error:", error);

		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "P2002"
		) {
			// Prisma unique constraint violation
			return NextResponse.json(
				{ message: "이미 존재하는 닉네임입니다." },
				{ status: 400 }
			);
		}

		return NextResponse.json(
			{ message: "서버 오류가 발생했습니다." },
			{ status: 500 }
		);
	}
}
