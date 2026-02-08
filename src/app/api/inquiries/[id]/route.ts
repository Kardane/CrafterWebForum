import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';


/**
 * GET /api/inquiries/[id]
 * 문의 상세 조회
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const inquiryId = parseInt(id);
		const session = await auth();

		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}
		if (isNaN(inquiryId)) {
			return NextResponse.json({ error: 'Invalid inquiry ID' }, { status: 400 });
		}

		const inquiry = await prisma.inquiry.findUnique({
			where: { id: inquiryId },
			include: {
				author: {
					select: {
						id: true,
						nickname: true,
					},
				},
				replies: {
					include: {
						author: {
							select: {
								id: true,
								nickname: true,
								role: true,
							},
						},
					},
					orderBy: { createdAt: 'asc' },
				},
			},
		});

		if (!inquiry) {
			return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
		}

		// 권한 검증: 본인 또는 관리자만 조회 가능
		if (inquiry.authorId !== session.user.id && session.user.role !== 'admin') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		return NextResponse.json({ inquiry, replies: inquiry.replies });
	} catch (error) {
		console.error('[API] GET /api/inquiries/[id] error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
