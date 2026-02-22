import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toSessionUserId } from "@/lib/session-user";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";

export async function PATCH(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const sessionUserId = toSessionUserId(session.user.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { id } = await params;
		const notificationId = Number.parseInt(id, 10);
		if (Number.isNaN(notificationId)) {
			return NextResponse.json({ error: "Invalid notification ID" }, { status: 400 });
		}

		await prisma.notification.updateMany({
			where: {
				id: notificationId,
				userId: sessionUserId,
			},
			data: {
				isRead: 1,
			},
		});

		const unreadCount = await prisma.notification.count({
			where: {
				userId: sessionUserId,
				isRead: 0,
			},
		});
		void broadcastRealtime({
			topic: REALTIME_TOPICS.user(sessionUserId),
			event: REALTIME_EVENTS.NOTIFICATION_READ_CHANGED,
			payload: {
				notificationId,
				unreadCount,
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[API] PATCH /api/notifications/[id]/read error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
