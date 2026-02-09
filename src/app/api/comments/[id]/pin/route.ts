import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) {
			return admin.response;
		}

		const { id } = await params;
		const commentId = Number.parseInt(id, 10);
		if (!Number.isInteger(commentId) || commentId <= 0) {
			return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
		}

		const existing = await prisma.comment.findUnique({
			where: { id: commentId },
			select: { id: true, isPinned: true, postId: true },
		});
		if (!existing) {
			return NextResponse.json({ error: "Comment not found" }, { status: 404 });
		}

		const nextPinned = existing.isPinned ? 0 : 1;
		const updated = await prisma.comment.update({
			where: { id: commentId },
			data: { isPinned: nextPinned },
			select: { id: true, isPinned: true },
		});

		await prisma.post.update({
			where: { id: existing.postId },
			data: { updatedAt: new Date() },
		});

		return NextResponse.json({
			success: true,
			comment: {
				id: updated.id,
				isPinned: Boolean(updated.isPinned),
			},
		});
	} catch (error) {
		console.error("[API] POST /api/comments/[id]/pin error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
