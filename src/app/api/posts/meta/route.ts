import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createServerTimingHeader } from "@/lib/server-timing";

export const preferredRegion = "icn1";

const MAX_POST_META_IDS = 30;

function parseTags(rawTags: string | null): string[] {
	if (!rawTags) {
		return [];
	}
	try {
		const parsed = JSON.parse(rawTags) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter((tag): tag is string => typeof tag === "string");
	} catch {
		return [];
	}
}

function parseIds(rawIds: string | null): number[] {
	if (!rawIds) {
		return [];
	}
	return Array.from(
		new Set(
			rawIds
				.split(",")
				.map((token) => Number.parseInt(token.trim(), 10))
				.filter((id) => Number.isInteger(id) && id > 0)
		)
	);
}

export async function GET(request: NextRequest) {
	const startedAt = performance.now();
	try {
		const authStart = performance.now();
		const session = await auth();
		const authMs = performance.now() - authStart;
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const ids = parseIds(request.nextUrl.searchParams.get("ids"));
		if (ids.length === 0) {
			return NextResponse.json({ error: "Invalid post ids" }, { status: 400 });
		}
		if (ids.length > MAX_POST_META_IDS) {
			return NextResponse.json({ error: "Too many post ids" }, { status: 400 });
		}

		const dbStart = performance.now();
		const posts = await prisma.post.findMany({
			where: {
				id: { in: ids },
				deletedAt: null,
			},
			select: {
				id: true,
				tags: true,
				views: true,
				likes: true,
				_count: {
					select: {
						comments: true,
					},
				},
			},
		});
		const dbMs = performance.now() - dbStart;

		const rowById = new Map(posts.map((row) => [row.id, row]));
		const items = ids
			.map((id) => {
				const row = rowById.get(id);
				if (!row) {
					return null;
				}
				const tags = parseTags(row.tags);
				return {
					id: row.id,
					category: tags[0] ?? "일반",
					views: row.views,
					likes: row.likes,
					comments: row._count.comments,
				};
			})
			.filter((item): item is NonNullable<typeof item> => item !== null);

		const response = NextResponse.json({ items });
		response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=120");
		response.headers.set(
			"Server-Timing",
			createServerTimingHeader([
				{ name: "auth", duration: authMs },
				{ name: "db", duration: dbMs },
				{ name: "total", duration: performance.now() - startedAt },
			])
		);
		return response;
	} catch (error) {
		console.error("[API] GET /api/posts/meta error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

