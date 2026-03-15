import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toSessionUserId } from "@/lib/session-user";
import { extractPollData, isPollEnded, processVote, updatePollInContent } from "@/lib/poll";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";
import { z } from "zod";

const voteBodySchema = z.object({
	optionId: z.number().int().min(0),
});

export async function POST(
	request: NextRequest,
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
		const commentId = Number.parseInt(id, 10);
		if (!Number.isInteger(commentId) || commentId <= 0) {
			return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
		}

		const parsedBody = voteBodySchema.safeParse(await request.json());
		if (!parsedBody.success) {
			return NextResponse.json({ error: "Invalid option ID" }, { status: 400 });
		}

		const comment = await prisma.comment.findUnique({
			where: { id: commentId },
			select: {
				id: true,
				postId: true,
				content: true,
			},
		});

		if (!comment) {
			return NextResponse.json({ error: "Comment not found" }, { status: 404 });
		}

		const pollData = extractPollData(comment.content);
		if (!pollData) {
			return NextResponse.json({ error: "Poll not found" }, { status: 400 });
		}

		if (!pollData.options.some((option) => option.id === parsedBody.data.optionId)) {
			return NextResponse.json({ error: "Option not found" }, { status: 400 });
		}

		if (isPollEnded(pollData)) {
			return NextResponse.json({ error: "Poll already ended" }, { status: 400 });
		}

		const nextPollData = processVote(pollData, String(sessionUserId), parsedBody.data.optionId);
		const nextContent = updatePollInContent(comment.content, nextPollData);
		const updatedComment = await prisma.comment.update({
			where: { id: commentId },
			data: {
				content: nextContent,
				updatedAt: new Date(),
			},
			select: {
				id: true,
				content: true,
				updatedAt: true,
			},
		});

		void broadcastRealtime({
			topic: REALTIME_TOPICS.post(comment.postId),
			event: REALTIME_EVENTS.COMMENT_UPDATED,
			payload: {
				postId: comment.postId,
				commentId: updatedComment.id,
				actorUserId: sessionUserId,
				content: updatedComment.content,
				updatedAt: updatedComment.updatedAt,
			},
		});

		return NextResponse.json({
			success: true,
			comment: {
				id: updatedComment.id,
				content: updatedComment.content,
				updatedAt: updatedComment.updatedAt,
			},
		});
	} catch (error) {
		console.error("[API] POST /api/comments/[id]/vote error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
