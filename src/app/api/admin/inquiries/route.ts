import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

function parseArchivedFlag(value: string | null) {
	return value === "true";
}

type InquiryRow = {
	id: number;
	title: string;
	status: string;
	createdAt: Date;
	archivedAt: Date | null;
	authorId: number;
};

function isArchivedAtColumnMissing(error: unknown) {
	return error instanceof Error && error.message.includes("archivedAt");
}

async function findInquiries(isArchived: boolean): Promise<InquiryRow[]> {
	try {
		return await prisma.inquiry.findMany({
			where: isArchived ? { archivedAt: { not: null } } : { archivedAt: null },
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				title: true,
				status: true,
				createdAt: true,
				archivedAt: true,
				authorId: true,
			},
		});
	} catch (error) {
		// 구 스키마(archivedAt 미존재)에서도 목록 조회 자체는 유지
		if (!isArchivedAtColumnMissing(error)) {
			throw error;
		}

		if (isArchived) {
			return [];
		}

		const fallbackRows = await prisma.inquiry.findMany({
			orderBy: { createdAt: "desc" },
			select: {
				id: true,
				title: true,
				status: true,
				createdAt: true,
				authorId: true,
			},
		});

		return fallbackRows.map((row) => ({
			...row,
			archivedAt: null,
		}));
	}
}

export async function GET(request: Request) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const isArchived = parseArchivedFlag(new URL(request.url).searchParams.get("archived"));
		const inquiries = await findInquiries(isArchived);
		const uniqueAuthorIds = Array.from(new Set(inquiries.map((inquiry) => inquiry.authorId)));
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
			inquiries: inquiries.map((inquiry) => ({
				id: inquiry.id,
				title: inquiry.title,
				status: inquiry.status,
				createdAt: inquiry.createdAt,
				archivedAt: inquiry.archivedAt,
				authorId: inquiry.authorId,
				authorName: authorNameMap.get(inquiry.authorId) ?? "알 수 없음",
			})),
		});
	} catch (error) {
		console.error("[API] GET /api/admin/inquiries error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
