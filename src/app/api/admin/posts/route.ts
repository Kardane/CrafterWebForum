import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/client";
import { requireAdmin } from "@/lib/admin-auth";

const prisma = new PrismaClient();

export async function GET() {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const posts = await prisma.post.findMany({
			orderBy: { createdAt: "desc" },
			include: {
				author: {
					select: { id: true, nickname: true },
				},
			},
		});

		return NextResponse.json({
			posts: posts.map((post) => ({
				id: post.id,
				title: post.title,
				createdAt: post.createdAt,
				deletedAt: post.deletedAt,
				authorId: post.authorId,
				authorName: post.author.nickname,
			})),
		});
	} catch (error) {
		console.error("[API] GET /api/admin/posts error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

