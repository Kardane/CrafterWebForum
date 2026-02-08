import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

function parseArchivedFlag(value: string | null) {
	return value === "true";
}

type PostRow = {
	id: number;
	title: string;
	createdAt: Date;
	deletedAt: Date | null;
	authorId: number;
};

export async function GET(request: Request) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;
		const isArchived = parseArchivedFlag(new URL(request.url).searchParams.get("archived"));

		const posts: PostRow[] = await prisma.post.findMany({
			where: isArchived ? { deletedAt: { not: null } } : { deletedAt: null },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				title: true,
				createdAt: true,
				deletedAt: true,
				authorId: true,
			},
		});
		const uniqueAuthorIds = Array.from(new Set(posts.map((post) => post.authorId)));
		const authors = uniqueAuthorIds.length
			? await prisma.user.findMany({
					where: { id: { in: uniqueAuthorIds } },
					select: { id: true, nickname: true },
				})
			: [];
		const authorNameMap = new Map<number, string>(
			authors.map((author) => [author.id, author.nickname])
		);

		return NextResponse.json({
			posts: posts.map((post) => ({
				id: post.id,
				title: post.title,
				createdAt: post.createdAt,
				deletedAt: post.deletedAt,
				authorId: post.authorId,
				authorName: authorNameMap.get(post.authorId) ?? "알 수 없음",
			})),
		});
	} catch (error) {
		console.error("[API] GET /api/admin/posts error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
