import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PrismaClient } from '@/generated/client';

const prisma = new PrismaClient();

// 임시 코드 저장소 (실제 운영 시에는 Redis 등을 권장)
// Key: userId, Value: { code: string, expires: number }
const authCodes = new Map<number, { code: string; expires: number }>();

/**
 * POST /api/users/me/minecraft-reauth
 * 마인크래프트 재인증 코드 발급
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// 6자리 랜덤 숫자 코드 생성
		const code = Math.floor(100000 + Math.random() * 900000).toString();
		const userId = session.user.id;

		// 코드 저장 (5분 유효)
		authCodes.set(userId, {
			code,
			expires: Date.now() + 5 * 60 * 1000,
		});

		// TODO: 실제 게임 서버와 통신하여 인증 대기 상태로 등록하는 로직 필요
		// 현재는 코드 발급만 수행

		return NextResponse.json({
			success: true,
			code,
			expiresIn: 300, // 5분
			message: 'Authentication code generated',
		});
	} catch (error) {
		console.error('[API] POST /api/users/me/minecraft-reauth error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * GET /api/users/me/minecraft-reauth
 * 인증 상태 확인 (클라이언트 폴링용)
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		// TODO: 실제 게임 서버나 DB에서 인증 완료 여부를 확인하는 로직 필요
		// 현재는 항상 미인증 상태 반환 (테스트 환경에서는 별도 mock API 필요)

		return NextResponse.json({
			verified: false,
			message: 'Waiting for authentication',
		});
	} catch (error) {
		console.error('[API] GET /api/users/me/minecraft-reauth error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
