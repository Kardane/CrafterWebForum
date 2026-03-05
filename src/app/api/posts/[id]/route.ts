import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPostDetail } from "@/lib/services/post-detail-service";
import { createServerTimingHeader } from "@/lib/server-timing";
import { getPostMutationTags, parsePostTags, safeRevalidateTags } from "@/lib/cache-tags";
import { isReservedPostTag, toStoredTags } from "@/lib/post-board";
import { resolveActiveUserFromSession } from "@/lib/active-user";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";
import { z } from "zod";

export const preferredRegion = "icn1";

function normalizeTags(value: unknown) {
	if (!Array.isArray(value)) {
		return [];
	}
	return value
		.filter((tag): tag is string => typeof tag === "string")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0 && !isReservedPostTag(tag));
}

const postUpdateBodySchema = z.object({
	title: z.string().trim().min(1),
	content: z.string().trim().min(1),
	tags: z.array(z.string()).optional().default([]),
});

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	void request;
	const requestStart = performance.now();
	try {
		const { id } = await params;

		const authStart = performance.now();
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session);
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}

		const sessionUserId = activeUser.context.userId;
		const authMs = performance.now() - authStart;

		const postId = Number.parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}

		const detail = await getPostDetail({ postId, sessionUserId });
		if (!detail) {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}

		const response = NextResponse.json({
			post: detail.post,
			comments: detail.comments,
			commentsPage: detail.commentsPage,
			readMarker: detail.readMarker,
		});
		response.headers.set(
			"Server-Timing",
			createServerTimingHeader([
				{ name: "auth", duration: authMs },
				{ name: "query_post", duration: detail.timing.queryPostMs },
				{ name: "query_like", duration: detail.timing.queryLikeMs },
				{ name: "query_comments", duration: detail.timing.queryCommentsMs },
				{ name: "query_read", duration: detail.timing.queryReadMs },
				{ name: "write_read", duration: detail.timing.writeReadMs },
				{ name: "serialize", duration: detail.timing.serializeMs },
				{ name: "total", duration: performance.now() - requestStart },
			])
		);

		return response;
	} catch (error) {
		console.error("[API] GET /api/posts/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function PATCH(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session);
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}

		const sessionUserId = activeUser.context.userId;

		const postId = Number.parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}

		const parsedBody = postUpdateBodySchema.safeParse(
			await readJsonBody(request, { maxBytes: 256 * 1024 })
		);
		if (!parsedBody.success) {
			return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
		}
		const { title, content, tags } = parsedBody.data;

		const post = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
		});

		if (!post) {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}

		if (post.authorId !== sessionUserId && activeUser.context.role !== "admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		const previousTags = parsePostTags(post.tags);
		const nextTags = normalizeTags(tags);

		await prisma.post.update({
			where: { id: postId },
			data: {
				title,
				content,
				tags: toStoredTags({ tags: nextTags }),
				updatedAt: new Date(),
			},
		});
		safeRevalidateTags(
			getPostMutationTags({
				postId,
				tags: [...previousTags, ...nextTags],
			})
		);

		return NextResponse.json({ success: true, message: "Post updated successfully" });
	} catch (error) {
		if (error instanceof JsonBodyError) {
			return NextResponse.json({ error: error.code }, { status: error.status });
		}
		console.error("[API] PATCH /api/posts/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	void request;
	try {
		const { id } = await params;
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session);
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}

		const sessionUserId = activeUser.context.userId;

		const postId = Number.parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}

		const post = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
		});

		if (!post) {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}

		if (post.authorId !== sessionUserId && activeUser.context.role !== "admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}
		const previousTags = parsePostTags(post.tags);

		await prisma.post.update({
			where: { id: postId },
			data: {
				deletedAt: new Date(),
			},
		});
		safeRevalidateTags(
			getPostMutationTags({
				postId,
				tags: previousTags,
			})
		);

		return NextResponse.json({ success: true, message: "Post deleted successfully" });
	} catch (error) {
		console.error("[API] DELETE /api/posts/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
