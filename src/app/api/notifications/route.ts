import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toSessionUserId } from "@/lib/session-user";

export async function GET(request: NextRequest) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const sessionUserId = toSessionUserId(session.user.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const countOnly = request.nextUrl.searchParams.get("countOnly") === "1";
		if (countOnly) {
			const unreadCount = await prisma.notification.count({
				where: {
					userId: sessionUserId,
					isRead: 0,
				},
			});
			return NextResponse.json({ unreadCount });
		}

		const notifications = await prisma.notification.findMany({
			where: {
				userId: sessionUserId,
			},
			orderBy: { createdAt: "desc" },
			take: 50,
			include: {
				actor: {
					select: {
						id: true,
						nickname: true,
					},
				},
			},
		});

		return NextResponse.json({ notifications });
	} catch (error) {
		console.error("[API] GET /api/notifications error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
