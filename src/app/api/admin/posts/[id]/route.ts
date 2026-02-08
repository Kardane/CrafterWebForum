import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";


export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const { id } = await params;
		const postId = parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}

		const post = await prisma.post.findUnique({ where: { id: postId } });
		if (!post) {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}

		await prisma.post.update({
			where: { id: postId },
			data: { deletedAt: new Date() },
		});

		console.warn(
			`[Admin] Post soft deleted by ${admin.session.user.id}: target=${postId}`
		);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[API] DELETE /api/admin/posts/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

