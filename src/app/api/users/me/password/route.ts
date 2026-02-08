import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { changeUserPassword } from '@/lib/user-service';

/**
 * POST /api/users/me/password
 * 비밀번호 변경
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
		}

		const body = await request.json() as {
			currentPassword?: unknown;
			newPassword?: unknown;
		};
		const result = await changeUserPassword(
			session.user.id,
			body.currentPassword,
			body.newPassword
		);

		if (!result.ok) {
			if (result.reason === 'validation_error') {
				return NextResponse.json({ error: 'validation_error' }, { status: 400 });
			}
			if (result.reason === 'wrong_password') {
				return NextResponse.json({ error: 'wrong_password' }, { status: 400 });
			}
			return NextResponse.json({ error: 'not_found' }, { status: 404 });
		}

		return NextResponse.json({
			success: true,
			message: 'password_updated',
		});
	} catch (error: unknown) {
		console.error('[API] POST /api/users/me/password error:', error);
		return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
	}
}
