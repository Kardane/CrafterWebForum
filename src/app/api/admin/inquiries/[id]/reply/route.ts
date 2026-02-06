import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/client";
import { requireAdmin } from "@/lib/admin-auth";

const prisma = new PrismaClient();

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

		console.info(
			`[Admin] Inquiry replied by ${admin.session.user.id}: target=${inquiryId}`
		);
		return NextResponse.json({ success: true, reply });
	} catch (error) {
		console.error("[API] POST /api/admin/inquiries/[id]/reply error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

