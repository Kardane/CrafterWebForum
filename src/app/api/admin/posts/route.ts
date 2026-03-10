import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeBoardType, parsePostTagMetadata } from "@/lib/post-board";
import { isMissingPostBoardMetadataColumnError } from "@/lib/db-schema-guard";

function parseArchivedFlag(value: string | null) {
	return value === "true";
}

function parsePositiveInt(value: string | null, fallback: number, max: number) {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return fallback;
	}
	return Math.min(parsed, max);
}

export async function GET(request: Request) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;
		const searchParams = new URL(request.url).searchParams;
		const isArchived = parseArchivedFlag(searchParams.get("archived"));
		const page = parsePositiveInt(searchParams.get("page"), 1, 100_000);
		const limit = parsePositiveInt(searchParams.get("limit"), 50, 200);
		const skip = (page - 1) * limit;

		const where = isArchived ? { deletedAt: { not: null } } : { deletedAt: null };
		let posts;
		let total;
		try {
			[posts, total] = await Promise.all([
				prisma.post.findMany({
					where,
					orderBy: { createdAt: "desc" },
					skip,
					take: limit,
					select: {
						id: true,
						title: true,
						board: true,
						serverAddress: true,
						createdAt: true,
						deletedAt: true,
						authorId: true,
					},
				}),
				prisma.post.count({ where }),
			]);
		} catch (error) {
			if (!isMissingPostBoardMetadataColumnError(error)) {
				throw error;
			}
			console.warn("[API] GET /api/admin/posts post board columns missing; using legacy tag metadata fallback");
			[posts, total] = await Promise.all([
				prisma.post.findMany({
					where,
					orderBy: { createdAt: "desc" },
					skip,
					take: limit,
					select: {
						id: true,
						title: true,
						tags: true,
						createdAt: true,
						deletedAt: true,
						authorId: true,
					},
				}),
				prisma.post.count({ where }),
			]);
		}
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
			posts: posts.map((post) => {
				const metadata = parsePostTagMetadata("tags" in post ? post.tags : null, "board" in post ? post.board : null, "serverAddress" in post ? post.serverAddress : null);
				return {
					id: post.id,
					title: post.title,
					board: normalizeBoardType(metadata.board),
					serverAddress: metadata.serverAddress,
					createdAt: post.createdAt,
					deletedAt: post.deletedAt,
					authorId: post.authorId,
					authorName: authorNameMap.get(post.authorId) ?? "알 수 없음",
				};
			}),
			page: {
				page,
				limit,
				total,
				totalPages: Math.max(1, Math.ceil(total / limit)),
				hasMore: skip + posts.length < total,
			},
		});
	} catch (error) {
		console.error("[API] GET /api/admin/posts error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
