import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PrismaClient } from '@/generated/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * POST /api/users/me/password
 * 비밀번호 변경
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const { currentPassword, newPassword } = body;

		if (!currentPassword || !newPassword) {
			return NextResponse.json(
				{ error: 'Current password and new password are required' },
				{ status: 400 }
			);
		}

		if (newPassword.length < 8) {
			return NextResponse.json(
				{ error: 'New password must be at least 8 characters long' },
				{ status: 400 }
			);
		}

		// 사용자 정보 조회 (비밀번호 해시 포함)
		const user = await prisma.user.findUnique({
			where: { id: session.user.id },
		});

		if (!user) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		// 현재 비밀번호 검증
		const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
		if (!isPasswordValid) {
			return NextResponse.json({ error: 'Invalid current password' }, { status: 400 });
		}

		// 새 비밀번호 해싱 및 업데이트
		const hashedPassword = await bcrypt.hash(newPassword, 10);
		await prisma.user.update({
			where: { id: user.id },
			data: { password: hashedPassword },
		});

		return NextResponse.json({
			success: true,
			message: 'Password updated successfully',
		});
	} catch (error) {
		console.error('[API] POST /api/users/me/password error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
