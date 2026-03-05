import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveActiveUserFromSession } from "@/lib/active-user";
import { isMissingPostSubscriptionTableError } from "@/lib/db-schema-guard";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";
import { z } from "zod";

const subscriptionPatchBodySchema = z.object({
	enabled: z.boolean(),
});

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const postId = Number.parseInt(id, 10);
		if (!Number.isInteger(postId) || postId <= 0) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}

		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session);
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}

		const parsedBody = subscriptionPatchBodySchema.safeParse(
			await readJsonBody(request, { maxBytes: 64 * 1024 })
		);
		if (!parsedBody.success) {
			return NextResponse.json({ error: "validation_error" }, { status: 400 });
		}

		const post = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
			select: {
				id: true,
			},
		});
		if (!post) {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}

		let fallbackLocalOnly = false;
		try {
			if (parsedBody.data.enabled) {
				await prisma.postSubscription.upsert({
					where: {
						userId_postId: {
							userId: activeUser.context.userId,
							postId,
						},
					},
					update: {
						updatedAt: new Date(),
					},
					create: {
						userId: activeUser.context.userId,
						postId,
					},
				});
			} else {
				await prisma.postSubscription.deleteMany({
					where: {
						userId: activeUser.context.userId,
						postId,
					},
				});
			}
		} catch (error) {
			if (isMissingPostSubscriptionTableError(error)) {
				fallbackLocalOnly = true;
			} else {
				throw error;
			}
		}

		return NextResponse.json({
			success: true,
			postId,
			enabled: parsedBody.data.enabled,
			fallbackLocalOnly,
		});
	} catch (error) {
		if (error instanceof JsonBodyError) {
			return NextResponse.json({ error: error.code }, { status: error.status });
		}
		console.error("[API] PATCH /api/posts/[id]/subscription error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
