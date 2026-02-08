import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getUserProfile } from '@/lib/user-service';
import { toSessionUserId } from '@/lib/session-user';

/**
 * GET /api/users/me
 * 내 정보 및 통계 조회
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

		const profile = await getUserProfile(userId);
		if (!profile) {
			return NextResponse.json({ error: 'not_found' }, { status: 404 });
		}

		return NextResponse.json(profile);
	} catch (error: unknown) {
		console.error('[API] GET /api/users/me error:', error);
		return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
	}
}
