import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";


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
		const restored = await prisma.inquiry.findUnique({
			where: { id: inquiryId },
			select: { status: true },
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
			event: REALTIME_EVENTS.INQUIRY_STATUS_UPDATED,
			payload: { inquiryId, status: restored?.status ?? "pending" },
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
				event: REALTIME_EVENTS.INQUIRY_STATUS_UPDATED,
				payload: { inquiryId, status: inquiry.status, archived: true },
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
			event: REALTIME_EVENTS.INQUIRY_STATUS_UPDATED,
			payload: { inquiryId, deleted: true },
		});
		console.warn(
			`[Admin] Inquiry permanently deleted by ${admin.session.user.id}: target=${inquiryId}`
		);

		return NextResponse.json({ success: true, mode: "permanently_deleted" });
	} catch (error) {
		console.error("[API] DELETE /api/admin/inquiries/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
