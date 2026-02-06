import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/client";
import { requireAdmin } from "@/lib/admin-auth";

const prisma = new PrismaClient();

export async function DELETE(
	_request: Request,
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

		const inquiry = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
		if (!inquiry) {
			return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
		}

		await prisma.inquiry.delete({ where: { id: inquiryId } });
		console.warn(
			`[Admin] Inquiry deleted by ${admin.session.user.id}: target=${inquiryId}`
		);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[API] DELETE /api/admin/inquiries/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

