import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toSessionUserId } from "@/lib/session-user";
import { getPostDetail } from "@/lib/services/post-detail-service";
import { createServerTimingHeader } from "@/lib/server-timing";

export const preferredRegion = "icn1";

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
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const sessionUserId = toSessionUserId(session.user.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
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
			readMarker: detail.readMarker,
		});
		response.headers.set(
			"Server-Timing",
			createServerTimingHeader([
				{ name: "auth", duration: authMs },
				{ name: "db_post", duration: detail.timing.dbPostMs },
				{ name: "db_like", duration: detail.timing.dbLikeMs },
				{ name: "db_comments", duration: detail.timing.dbCommentsMs },
				{ name: "db_read", duration: detail.timing.dbReadMs },
				{ name: "db_write", duration: detail.timing.dbWriteMs },
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
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const sessionUserId = toSessionUserId(session.user.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const postId = Number.parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}

		const body = await request.json();
		const { title, content, tags } = body;

		if (!title || !content) {
			return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
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

		if (post.authorId !== sessionUserId) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		await prisma.post.update({
			where: { id: postId },
			data: {
				title,
				content,
				tags: JSON.stringify(tags || []),
				updatedAt: new Date(),
			},
		});

		return NextResponse.json({ success: true, message: "Post updated successfully" });
	} catch (error) {
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
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const sessionUserId = toSessionUserId(session.user.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

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

		if (post.authorId !== sessionUserId && session.user.role !== "admin") {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		await prisma.post.update({
			where: { id: postId },
			data: {
				deletedAt: new Date(),
			},
		});

		return NextResponse.json({ success: true, message: "Post deleted successfully" });
	} catch (error) {
		console.error("[API] DELETE /api/posts/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
