import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toSessionUserId } from "@/lib/session-user";
import { listPosts } from "@/lib/services/posts-service";
import { createServerTimingHeader } from "@/lib/server-timing";
import { getPostMutationTags, safeRevalidateTags } from "@/lib/cache-tags";
import { normalizeBoardType, toStoredTags } from "@/lib/post-board";
import { parseServerAddress } from "@/lib/server-address";

export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

function parsePositiveInt(value: string | null, fallback: number) {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return fallback;
	}
	return parsed;
}

export async function GET(req: NextRequest) {
	const requestStart = performance.now();
	try {
		const authStart = performance.now();
		const session = await auth();
		const sessionUserId = toSessionUserId(session?.user?.id);
		const authMs = performance.now() - authStart;

		const { searchParams } = new URL(req.url);
		const data = await listPosts({
			page: parsePositiveInt(searchParams.get("page"), 1),
			limit: parsePositiveInt(searchParams.get("limit"), 12),
			tag: searchParams.get("tag"),
			board: searchParams.get("board") === "ombudsman" ? "ombudsman" : "forum",
			sort: searchParams.get("sort") ?? "activity",
			search: searchParams.get("search") ?? "",
			sessionUserId,
		});

		const response = NextResponse.json({
			posts: data.posts,
			metadata: data.metadata,
		});
		response.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=45");
		response.headers.set(
			"Server-Timing",
			createServerTimingHeader([
				{ name: "auth", duration: authMs },
				{ name: "query_main", duration: data.timing.queryMainMs },
				{ name: "query_aux", duration: data.timing.queryAuxMs },
				{ name: "serialize", duration: data.timing.serializeMs },
				{ name: "total", duration: performance.now() - requestStart },
			])
		);

		return response;
	} catch (error: unknown) {
		console.error("[API] Posts List Error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}

export async function POST(request: NextRequest) {
	try {
		const session = await auth();
		const sessionUserId = toSessionUserId(session?.user?.id);
		if (!sessionUserId) {
			return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		}

		const body = (await request.json()) as {
			title?: unknown;
			content?: unknown;
			tags?: unknown;
			board?: unknown;
			serverAddress?: unknown;
		};

		const title = typeof body.title === "string" ? body.title.trim() : "";
		const content = typeof body.content === "string" ? body.content.trim() : "";
		if (!title || !content) {
			return NextResponse.json({ error: "validation_error" }, { status: 400 });
		}

		const tags = Array.isArray(body.tags)
			? body.tags.filter(
					(tag): tag is string => typeof tag === "string" && tag.trim().length > 0
			  )
			: [];
		const board = normalizeBoardType(body.board);
		const rawServerAddress = typeof body.serverAddress === "string" ? body.serverAddress.trim() : "";

		let parsedServerAddress: ReturnType<typeof parseServerAddress> = null;
		if (board === "ombudsman") {
			parsedServerAddress = parseServerAddress(rawServerAddress);
			if (!parsedServerAddress) {
				return NextResponse.json({ error: "invalid_server_address" }, { status: 400 });
			}
		}
		const storedTags = toStoredTags({
			board,
			tags,
			serverAddress: parsedServerAddress?.normalizedAddress ?? null,
		});

		const post = await prisma.post.create({
			data: {
				title,
				content,
				tags: storedTags,
				authorId: sessionUserId,
			},
		});
		safeRevalidateTags(
			getPostMutationTags({
				postId: post.id,
				tags,
			})
		);

		return NextResponse.json({
			success: true,
			message: "created",
			postId: post.id,
		});
	} catch (error: unknown) {
		console.error("[API] POST /api/posts error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
