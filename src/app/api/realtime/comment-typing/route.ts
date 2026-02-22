import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { toSessionUserId } from "@/lib/session-user";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";

export async function POST(request: NextRequest) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const sessionUserId = toSessionUserId(session.user.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = (await request.json()) as { postId?: number; typing?: boolean };
		const postId = Number(body.postId ?? 0);
		if (!Number.isInteger(postId) || postId <= 0) {
			return NextResponse.json({ error: "Invalid postId" }, { status: 400 });
		}

		void broadcastRealtime({
			topic: REALTIME_TOPICS.post(postId),
			event: REALTIME_EVENTS.COMMENT_TYPING_CHANGED,
			payload: {
				postId,
				userId: sessionUserId,
				nickname: session.user.nickname,
				typing: Boolean(body.typing),
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[API] POST /api/realtime/comment-typing error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
