import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";


export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const { id } = await params;
		const userId = parseInt(id, 10);
		if (Number.isNaN(userId)) {
			return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
		}

		const target = await prisma.user.findUnique({ where: { id: userId } });
		if (!target) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		await prisma.user.update({
			where: { id: userId },
			data: { isApproved: 1 },
		});

		void broadcastRealtime({
			topic: REALTIME_TOPICS.adminUsers(),
			event: REALTIME_EVENTS.ADMIN_USER_APPROVAL_UPDATED,
			payload: { userId, action: "approved" },
		});

		console.info(`[Admin] User approved by ${admin.session.user.id}: target=${userId}`);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[API] POST /api/admin/users/[id]/approve error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
