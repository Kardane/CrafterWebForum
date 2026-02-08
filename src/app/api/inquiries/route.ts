import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PrismaClient } from '@/generated/client';

const prisma = new PrismaClient();

/**
 * GET /api/inquiries
 * 내 문의 목록 조회 (관리자는 전체 목록)
 */
export async function GET(request: NextRequest) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const where = session.user.role === 'admin'
			? {}
			: { authorId: session.user.id };

		const inquiries = await prisma.inquiry.findMany({
			where,
			orderBy: { createdAt: 'desc' },
			include: {
				author: {
					select: {
						nickname: true,
					},
				},
				_count: {
					select: { replies: true },
				},
			},
		});

		// 클라이언트 사용 편의를 위해 데이터 가공
		const formattedInquiries = inquiries.map((inquiry) => ({
			id: inquiry.id,
			title: inquiry.title,
			status: inquiry.status,
			createdAt: inquiry.createdAt,
			authorName: inquiry.author.nickname,
			replyCount: inquiry._count.replies,
		}));

		return NextResponse.json({ inquiries: formattedInquiries });
	} catch (error) {
		console.error('[API] GET /api/inquiries error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

/**
 * POST /api/inquiries
 * 문의 작성
 */
export async function POST(request: NextRequest) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await request.json();
		const { title, content } = body;

		if (!title || !content) {
			return NextResponse.json(
				{ error: 'Title and content are required' },
				{ status: 400 }
			);
		}

		const inquiry = await prisma.inquiry.create({
			data: {
				title,
				content,
				authorId: session.user.id,
			},
		});

		return NextResponse.json({
			success: true,
			message: 'Inquiry created successfully',
			inquiryId: inquiry.id,
		});
	} catch (error) {
		console.error('[API] POST /api/inquiries error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
