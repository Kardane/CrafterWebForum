import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { toSessionUserId } from '@/lib/session-user';
import {
	generateMinecraftAuthCode,
	MINECRAFT_REAUTH_CODE_LENGTH,
} from '@/lib/minecraft-auth-code';

const REAUTH_TTL_SECONDS = 300;
const REAUTH_MARKER_PREFIX = 'reauth:';
const REAUTH_CODE_MAX_RETRY = 6;

function createReauthCode(): string {
	return generateMinecraftAuthCode(MINECRAFT_REAUTH_CODE_LENGTH);
}

function getReauthMarker(userId: number): string {
	return `${REAUTH_MARKER_PREFIX}${userId}`;
}

async function issueUniqueCode(): Promise<string> {
	for (let attempt = 0; attempt < REAUTH_CODE_MAX_RETRY; attempt += 1) {
		const code = createReauthCode();
		const existing = await prisma.minecraftCode.findUnique({
			where: { code },
			select: { code: true },
		});
		if (!existing) {
			return code;
		}
	}

	throw new Error('reauth_code_generation_failed');
}

/**
 * POST /api/users/me/minecraft-reauth
 * 마인크래프트 재인증 코드 발급
 */
export async function POST(request: NextRequest) {
	void request;
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
		}

		const userId = toSessionUserId(session.user.id);
		if (!userId) {
			return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
		}
		const marker = getReauthMarker(userId);
		const now = Date.now();
		const validAfter = new Date(now - REAUTH_TTL_SECONDS * 1000);

		// 동일 사용자의 이전 재인증 코드는 정리하고 새 코드로 교체
		await prisma.minecraftCode.deleteMany({
			where: {
				userId,
				ipAddress: marker,
			},
		});

		await prisma.minecraftCode.deleteMany({
			where: {
				ipAddress: { startsWith: REAUTH_MARKER_PREFIX },
				createdAt: { lt: validAfter },
			},
		});

		const code = await issueUniqueCode();
		await prisma.minecraftCode.create({
			data: {
				code,
				userId,
				ipAddress: marker,
				isVerified: 0,
			},
		});

		return NextResponse.json({
			success: true,
			code,
			expiresIn: REAUTH_TTL_SECONDS,
			message: 'code_issued',
		});
	} catch (error: unknown) {
		console.error('[API] POST /api/users/me/minecraft-reauth error:', error);
		return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
	}
}

/**
 * GET /api/users/me/minecraft-reauth
 * 인증 상태 확인 (클라이언트 폴링용)
 */
export async function GET(request: NextRequest) {
	void request;
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
		}

		const userId = toSessionUserId(session.user.id);
		if (!userId) {
			return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
		}
		const marker = getReauthMarker(userId);
		const latestCode = await prisma.minecraftCode.findFirst({
			where: {
				userId,
				ipAddress: marker,
			},
			orderBy: { createdAt: 'desc' },
			select: {
				code: true,
				createdAt: true,
				isVerified: true,
				linkedNickname: true,
				linkedUuid: true,
			},
		});

		if (!latestCode) {
			return NextResponse.json({
				verified: false,
				expiresIn: 0,
				message: 'pending_code_not_found',
			});
		}

		const expiresAt = latestCode.createdAt.getTime() + REAUTH_TTL_SECONDS * 1000;
		const timeLeftMs = expiresAt - Date.now();
		if (timeLeftMs <= 0) {
			await prisma.minecraftCode.delete({ where: { code: latestCode.code } });
			return NextResponse.json({
				verified: false,
				expiresIn: 0,
				message: 'expired',
			});
		}

		if (!latestCode.isVerified) {
			return NextResponse.json({
				verified: false,
				expiresIn: Math.ceil(timeLeftMs / 1000),
				message: 'waiting_for_verification',
			});
		}

		const verifiedNickname = latestCode.linkedNickname;
		const verifiedUuid = latestCode.linkedUuid;
		if (!verifiedNickname || !verifiedUuid) {
			return NextResponse.json({
				verified: false,
				expiresIn: Math.ceil(timeLeftMs / 1000),
				message: 'verification_payload_missing',
			});
		}

		await prisma.user.update({
			where: { id: userId },
			data: {
				nickname: verifiedNickname,
				minecraftNickname: verifiedNickname,
				minecraftUuid: verifiedUuid,
				lastAuthAt: new Date(),
			},
		});

		await prisma.minecraftCode.delete({ where: { code: latestCode.code } });

		return NextResponse.json({
			verified: true,
			nickname: verifiedNickname,
			message: 'verified',
		});
	} catch (error: unknown) {
		console.error('[API] GET /api/users/me/minecraft-reauth error:', error);
		return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
	}
}
