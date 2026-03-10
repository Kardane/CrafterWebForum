import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toSessionUserId } from "@/lib/session-user";
import { listPosts } from "@/lib/services/posts-service";
import { createServerTimingHeader } from "@/lib/server-timing";
import { getPostMutationTags, safeRevalidateTags } from "@/lib/cache-tags";
import { normalizeBoardType, toStoredTags } from "@/lib/post-board";
import { resolveActiveUserFromSession } from "@/lib/active-user";
import {
	isMissingPostBoardMetadataColumnError,
	isMissingPostSubscriptionTableError,
} from "@/lib/db-schema-guard";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";
import { z } from "zod";

export const dynamic = "force-dynamic";
export const preferredRegion = "icn1";

function parsePositiveInt(value: string | null, fallback: number) {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return fallback;
	}
	return parsed;
}

const postCreateBodySchema = z.object({
	title: z.string().trim().min(1),
	content: z.string().trim().min(1),
	board: z.string().optional(),
	serverAddress: z.string().trim().optional().nullable(),
	tags: z
		.array(z.string())
		.optional()
		.transform((value) =>
			(value ?? [])
				.map((tag) => tag.trim())
				.filter((tag) => tag.length > 0)
		),
});

export async function GET(req: NextRequest) {
	const requestStart = performance.now();
	try {
		const authStart = performance.now();
		const session = await auth();
		const sessionUserId = toSessionUserId(session?.user?.id);
		const authMs = performance.now() - authStart;

		const { searchParams } = new URL(req.url);
		const page = parsePositiveInt(searchParams.get("page"), 1);
		const data = await listPosts({
			page,
			limit: parsePositiveInt(searchParams.get("limit"), 12),
			tag: searchParams.get("tag"),
			board: normalizeBoardType(searchParams.get("board")),
			sort: searchParams.get("sort") ?? "activity",
			search: searchParams.get("search") ?? "",
			searchInComments: searchParams.get("searchInComments") === "1",
			sessionUserId,
			includeUserOverlay: true,
			skipExactTotal: page > 1,
		});

		const response = NextResponse.json({
			posts: data.posts,
			metadata: data.metadata,
		});
		response.headers.set("X-Posts-Total-Mode", page > 1 ? "estimated" : "exact");
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
		const activeUser = await resolveActiveUserFromSession(session);
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}
		const sessionUserId = activeUser.context.userId;

		const parsedBody = postCreateBodySchema.safeParse(
			await readJsonBody(request, { maxBytes: 256 * 1024 })
		);
		if (!parsedBody.success) {
			return NextResponse.json({ error: "validation_error" }, { status: 400 });
		}
		const title = parsedBody.data.title;
		const content = parsedBody.data.content;
		const tags = parsedBody.data.tags;
		const board = normalizeBoardType(parsedBody.data.board);
		const serverAddress = parsedBody.data.serverAddress?.trim() || null;
		const storedTags = toStoredTags({
			tags,
			board,
			serverAddress,
		});
		if (board === "sinmungo" && !serverAddress) {
			return NextResponse.json({ error: "server_address_required" }, { status: 400 });
		}

		let post;
		try {
			post = await prisma.post.create({
				data: {
					title,
					content,
					board,
					serverAddress,
					tags: storedTags,
					commentCount: 0,
					authorId: sessionUserId,
				},
			});
		} catch (error) {
			if (!isMissingPostBoardMetadataColumnError(error)) {
				throw error;
			}
			console.warn("[API] POST /api/posts post board columns missing; storing board metadata in tags only");
			post = await prisma.post.create({
				data: {
					title,
					content,
					tags: storedTags,
					commentCount: 0,
					authorId: sessionUserId,
				},
			});
		}
		try {
			await prisma.postSubscription.upsert({
				where: {
					userId_postId: {
						userId: sessionUserId,
						postId: post.id,
					},
				},
				update: {
					updatedAt: new Date(),
				},
				create: {
					userId: sessionUserId,
					postId: post.id,
				},
			});
		} catch (error) {
			if (!isMissingPostSubscriptionTableError(error)) {
				throw error;
			}
			console.warn("[API] POST /api/posts post subscription table missing; skipping authored auto-subscription");
		}
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
		if (error instanceof JsonBodyError) {
			return NextResponse.json({ error: error.code }, { status: error.status });
		}
		console.error("[API] POST /api/posts error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
