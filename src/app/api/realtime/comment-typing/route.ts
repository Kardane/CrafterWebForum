import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { toSessionUserId } from "@/lib/session-user";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";
import { z } from "zod";

const commentTypingBodySchema = z.object({
	postId: z.preprocess((value) => Number(value), z.number().int().positive()),
	typing: z.preprocess((value) => Boolean(value), z.boolean()).optional(),
});

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

		const parsedBody = commentTypingBodySchema.safeParse(
			await readJsonBody(request, { maxBytes: 64 * 1024 })
		);
		if (!parsedBody.success) {
			return NextResponse.json({ error: "Invalid postId" }, { status: 400 });
		}
		const postId = parsedBody.data.postId;

		void broadcastRealtime({
			topic: REALTIME_TOPICS.post(postId),
			event: REALTIME_EVENTS.COMMENT_TYPING_CHANGED,
			payload: {
				postId,
				userId: sessionUserId,
				nickname: session.user.nickname,
				typing: Boolean(parsedBody.data.typing),
			},
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		if (error instanceof JsonBodyError) {
			return NextResponse.json({ error: error.code }, { status: error.status });
		}
		console.error("[API] POST /api/realtime/comment-typing error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
