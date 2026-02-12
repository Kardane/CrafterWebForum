import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { toSessionUserId } from "@/lib/session-user";

export const dynamic = "force-dynamic"; // 항상 최신 데이터 조회

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

export async function GET(req: NextRequest) {
	try {
		const session = await auth();
		const sessionUserId = toSessionUserId(session?.user?.id);
		const { searchParams } = new URL(req.url);
		const page = parseInt(searchParams.get("page") || "1", 10);
		const limit = parseInt(searchParams.get("limit") || "12", 10);
		const tag = searchParams.get("tag");
		const sort = searchParams.get("sort") || "activity";
		const search = searchParams.get("search")?.trim() ?? "";

		const skip = (page - 1) * limit;

		// 기본 필터 조건 (삭제되지 않은 게시글)
		const whereCondition: Prisma.PostWhereInput = {
			deletedAt: null,
		};

		if (tag) {
			whereCondition.tags = {
				contains: `"${tag}"`,
			};
		}

		if (search.length > 0) {
			whereCondition.OR = [
				{ title: { contains: search } },
				{ content: { contains: search } },
				{ comments: { some: { content: { contains: search } } } },
			];
		}

		let orderBy:
			| Prisma.PostOrderByWithRelationInput
			| Prisma.PostOrderByWithRelationInput[] = { updatedAt: "desc" };

		switch (sort) {
			case "oldest":
				orderBy = { createdAt: "asc" };
				break;
			case "likes":
				orderBy = [{ likes: "desc" }, { createdAt: "desc" }];
				break;
			case "comments":
				orderBy = { comments: { _count: "desc" } };
				break;
			case "activity":
				orderBy = { updatedAt: "desc" };
				break;
			default:
				orderBy = { updatedAt: "desc" };
			}

		const include: Prisma.PostInclude = {
			author: {
				select: {
					nickname: true,
					minecraftUuid: true,
				},
			},
			_count: {
				select: {
					comments: true,
				},
			},
			postReads: {
				where: {
					userId: sessionUserId ?? -1,
				},
				select: {
					lastReadCommentCount: true,
				},
				take: 1,
			},
		};

		const [posts, total] = await prisma.$transaction([
			prisma.post.findMany({
				where: whereCondition,
				take: limit,
				skip,
				orderBy,
				include,
			}),
			prisma.post.count({ where: whereCondition }),
		]);

		let likedPostIds: number[] = [];
		if (sessionUserId) {
			const likes = await prisma.like.findMany({
				where: {
					userId: sessionUserId,
					postId: { in: posts.map((post) => post.id) },
				},
				select: { postId: true },
			});
			likedPostIds = likes.map((like) => like.postId);
		}

		const formattedPosts = posts.map((post) => ({
			id: post.id,
			title: post.title,
			content: post.content,
			tags: parseTags(post.tags),
			likes: post.likes,
			views: post.views,
			createdAt: post.createdAt,
			updatedAt: post.updatedAt,
			authorName: post.author.nickname,
			authorUuid: post.author.minecraftUuid,
			commentCount: post._count.comments,
			unreadCount: Math.max(
				post._count.comments - (post.postReads?.[0]?.lastReadCommentCount ?? 0),
				0
			),
			userLiked: likedPostIds.includes(post.id),
		}));

		const totalPages = Math.ceil(total / limit);

		return NextResponse.json({
			posts: formattedPosts,
			metadata: {
				total,
				page,
				limit,
				totalPages,
			},
		});
	} catch (error: unknown) {
		console.error("[API] Posts List Error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}

/**
 * POST /api/posts
 * 게시글 작성
 */
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

		const post = await prisma.post.create({
			data: {
				title,
				content,
				tags: JSON.stringify(tags),
				authorId: sessionUserId,
			},
		});

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
