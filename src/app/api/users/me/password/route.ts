import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { changeUserPassword } from '@/lib/user-service';
import { resolveActiveUserFromSession } from '@/lib/active-user';
import { JsonBodyError, readJsonBody } from '@/lib/http-body';
import { z } from 'zod';

const changePasswordBodySchema = z.object({
	currentPassword: z.string().trim().min(1),
	newPassword: z.string().trim().min(1),
});

/**
 * POST /api/users/me/password
 * 비밀번호 변경
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session);
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}

		const parsedBody = changePasswordBodySchema.safeParse(
			await readJsonBody(request, { maxBytes: 128 * 1024 })
		);
		if (!parsedBody.success) {
			return NextResponse.json({ error: 'validation_error' }, { status: 400 });
		}
		const result = await changeUserPassword(
			activeUser.context.userId,
			parsedBody.data.currentPassword,
			parsedBody.data.newPassword
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
		if (error instanceof JsonBodyError) {
			return NextResponse.json({ error: error.code }, { status: error.status });
		}
		console.error('[API] POST /api/users/me/password error:', error);
		return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
	}
}
