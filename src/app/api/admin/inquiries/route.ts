import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

function parseArchivedFlag(value: string | null) {
	return value === "true";
}

export async function GET(request: Request) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const isArchived = parseArchivedFlag(new URL(request.url).searchParams.get("archived"));
		const inquiries = await prisma.inquiry.findMany({
			where: isArchived ? { archivedAt: { not: null } } : { archivedAt: null },
			orderBy: { createdAt: "desc" },
			include: {
				author: {
					select: { id: true, nickname: true },
				},
			},
		});

		return NextResponse.json({
			inquiries: inquiries.map((inquiry) => ({
				id: inquiry.id,
				title: inquiry.title,
				status: inquiry.status,
				createdAt: inquiry.createdAt,
				archivedAt: inquiry.archivedAt,
				authorId: inquiry.authorId,
				authorName: inquiry.author.nickname,
			})),
		});
	} catch (error) {
		console.error("[API] GET /api/admin/inquiries error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
