import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { PrismaClient } from '@/generated/client';

const prisma = new PrismaClient();

/**
 * POST /api/inquiries/[id]/reply
 * 문의 답변 작성
 */
export async function POST(
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

		const body = await request.json();
		const { content } = body;

		if (!content) {
			return NextResponse.json({ error: 'Content is required' }, { status: 400 });
		}

		// 문의 존재 여부 및 권한 확인
		const inquiry = await prisma.inquiry.findUnique({
			where: { id: inquiryId },
		});

		if (!inquiry) {
			return NextResponse.json({ error: 'Inquiry not found' }, { status: 404 });
		}

		// 관리자 또는 원작자만 답변 가능
		if (session.user.role !== 'admin' && inquiry.authorId !== session.user.id) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// 답변 생성
		const reply = await prisma.inquiryReply.create({
			data: {
				content,
				inquiryId: inquiryId,
				authorId: session.user.id,
			},
			include: {
				author: {
					select: {
						id: true,
						nickname: true,
						role: true,
					},
				},
			},
		});

		// 관리자가 답변했으면 상태를 'answered'로 변경
		if (session.user.role === 'admin') {
			await prisma.inquiry.update({
				where: { id: inquiryId },
				data: { status: 'answered' },
			});
		}

		return NextResponse.json({
			success: true,
			message: 'Reply created successfully',
			reply,
		});
	} catch (error) {
		console.error('[API] POST /api/inquiries/[id]/reply error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}
