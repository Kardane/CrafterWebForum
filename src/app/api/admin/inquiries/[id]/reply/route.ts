import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";


export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const { id } = await params;
		const inquiryId = parseInt(id, 10);
		if (Number.isNaN(inquiryId)) {
			return NextResponse.json({ error: "Invalid inquiry ID" }, { status: 400 });
		}

		const body = (await request.json()) as { content?: string };
		const content = body.content?.trim();
		if (!content) {
			return NextResponse.json({ error: "Content is required" }, { status: 400 });
		}

		const inquiry = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
		if (!inquiry) {
			return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
		}
		if (inquiry.archivedAt) {
			return NextResponse.json(
				{ error: "Archived inquiry cannot be replied" },
				{ status: 409 }
			);
		}

		const reply = await prisma.inquiryReply.create({
			data: {
				inquiryId,
				content,
				authorId: admin.session.user.id,
			},
			include: {
				author: {
					select: { id: true, nickname: true, role: true },
				},
			},
		});

		await prisma.inquiry.update({
			where: { id: inquiryId },
			data: { status: "answered" },
		});

		const pendingCount = await prisma.inquiry.count({
			where: { status: "pending", archivedAt: null },
		});
		void broadcastRealtime({
			topic: REALTIME_TOPICS.adminInquiries(),
			event: REALTIME_EVENTS.ADMIN_INQUIRY_PENDING_COUNT_UPDATED,
			payload: { pendingCount },
		});
		void broadcastRealtime({
			topic: REALTIME_TOPICS.inquiry(inquiryId),
			event: REALTIME_EVENTS.INQUIRY_REPLY_CREATED,
			payload: { inquiryId, replyId: reply.id, status: "answered" },
		});

		console.info(
			`[Admin] Inquiry replied by ${admin.session.user.id}: target=${inquiryId}`
		);
		return NextResponse.json({ success: true, reply });
	} catch (error) {
		console.error("[API] POST /api/admin/inquiries/[id]/reply error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
