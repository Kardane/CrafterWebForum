import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";


function parseInquiryId(value: string) {
	const inquiryId = parseInt(value, 10);
	if (Number.isNaN(inquiryId)) {
		return null;
	}
	return inquiryId;
}

function parsePermanentFlag(value: string | null) {
	return value === "true";
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const { id } = await params;
		const inquiryId = parseInquiryId(id);
		if (!inquiryId) {
			return NextResponse.json({ error: "Invalid inquiry ID" }, { status: 400 });
		}

		const body = (await request.json()) as { action?: string };
		if (body.action !== "restore") {
			return NextResponse.json({ error: "Invalid action" }, { status: 400 });
		}

		const inquiry = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
		if (!inquiry) {
			return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
		}
		if (!inquiry.archivedAt) {
			return NextResponse.json(
				{ error: "Inquiry is not archived" },
				{ status: 409 }
			);
		}

		await prisma.inquiry.update({
			where: { id: inquiryId },
			data: { archivedAt: null },
		});
		console.info(
			`[Admin] Inquiry restored by ${admin.session.user.id}: target=${inquiryId}`
		);

		return NextResponse.json({ success: true, mode: "restored" });
	} catch (error) {
		console.error("[API] PATCH /api/admin/inquiries/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const { id } = await params;
		const inquiryId = parseInquiryId(id);
		if (!inquiryId) {
			return NextResponse.json({ error: "Invalid inquiry ID" }, { status: 400 });
		}
		const isPermanent = parsePermanentFlag(
			new URL(request.url).searchParams.get("permanent")
		);

		const inquiry = await prisma.inquiry.findUnique({ where: { id: inquiryId } });
		if (!inquiry) {
			return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
		}

		if (!inquiry.archivedAt) {
			await prisma.inquiry.update({
				where: { id: inquiryId },
				data: { archivedAt: new Date() },
			});
			console.warn(
				`[Admin] Inquiry archived by ${admin.session.user.id}: target=${inquiryId}`
			);
			return NextResponse.json({ success: true, mode: "archived" });
		}

		if (!isPermanent) {
			return NextResponse.json(
				{ error: "Inquiry is archived. Use permanent delete option" },
				{ status: 409 }
			);
		}

		await prisma.inquiry.delete({ where: { id: inquiryId } });
		console.warn(
			`[Admin] Inquiry permanently deleted by ${admin.session.user.id}: target=${inquiryId}`
		);

		return NextResponse.json({ success: true, mode: "permanently_deleted" });
	} catch (error) {
		console.error("[API] DELETE /api/admin/inquiries/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
