import { NextRequest, NextResponse } from "next/server";
import { Prisma, PrismaClient } from "@/generated/client";
import { auth } from "@/auth";

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic'; // 항상 최신 데이터 조회

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const page = parseInt(searchParams.get("page") || "1");
		const limit = parseInt(searchParams.get("limit") || "12");
		const tag = searchParams.get("tag");
		const sort = searchParams.get("sort") || "newest";
		const search = searchParams.get("search");

		const skip = (page - 1) * limit;

		// 기본 필터 조건 (삭제되지 않은 게시글)
		const whereCondition: Prisma.PostWhereInput = {
			deletedAt: null,
		};

		// 태그 필터 (JSON 배열 내 검색은 Prisma raw query가 아니면 contains로 처리)
		// SQLite에서는 JSON 필드 검색이 제한적일 수 있으나, Prisma 문자열 필터로 처리 시도
		if (tag) {
			whereCondition.tags = {
				contains: `"${tag}"`, // JSON 문자열 내 태그 검색 (단순 contains 사용)
			};
		}

		// 검색 (제목 또는 내용)
		if (search) {
			whereCondition.OR = [
				{ title: { contains: search } }, // 대소문자 구분 없이 검색 (SQLite 기본)
				{ content: { contains: search } },
			];
		}

		// 정렬 조건 설정
		let orderBy:
			| Prisma.PostOrderByWithRelationInput
			| Prisma.PostOrderByWithRelationInput[] = { createdAt: "desc" };
		switch (sort) {
			case "oldest":
				orderBy = { createdAt: "asc" };
				break;
			case "likes":
				orderBy = [{ likes: "desc" }, { createdAt: "desc" }];
				break;
			case "comments":
				// Prisma 관계 정렬은 제한적이므로, 댓글 수는 별도 로직이나 raw query 필요할 수 있음.
				// 여기서는 comments relation count로 정렬하는 기능은 Prisma ORM 레벨에서 직접 지원하지 않을 수 있어(버전별 상이),
				// 일단 likes 정렬과 동일하게 처리하거나 activity(최근 활동)로 대체 고려.
				// 6.x 버전에서는 relation count sort 지원 확인 필요 -> 지원함.
				orderBy = { comments: { _count: "desc" } };
				break;
			case "activity":
				// 최근 활동순: 댓글 생성일 또는 게시글 생성일. 복잡하므로 일단 최신순으로 fallback하거나 구현 보류
				// 정확한 구현을 위해선 Raw Query 권장되나, 여기선 최신순으로 처리
				orderBy = { updatedAt: "desc" };
				break;
			default: // newest
				orderBy = { createdAt: "desc" };
		}

		// 트랜잭션으로 병렬 조회
		const [posts, total] = await prisma.$transaction([
			prisma.post.findMany({
				where: whereCondition,
				take: limit,
				skip: skip,
				orderBy: orderBy,
				include: {
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
				},
			}),
			prisma.post.count({ where: whereCondition }),
		]);

		// 로그인한 경우 좋아요 여부 확인
		const session = await auth();
		let likedPostIds: number[] = [];
		if (session?.user?.id) {
			const likes = await prisma.like.findMany({
				where: {
					userId: parseInt(session.user.id.toString()),
					postId: { in: posts.map((p) => p.id) },
				},
				select: { postId: true },
			});
			likedPostIds = likes.map((l) => l.postId);
		}

		// 데이터 가공 (프론트엔드 포맷)
		const formattedPosts = posts.map((post) => ({
			id: post.id,
			title: post.title,
			content: post.content, // 본문 일부만 보낼지 고려 (여기선 전체)
			tags: JSON.parse(post.tags as string || "[]"),
			likes: post.likes,
			views: post.views,
			createdAt: post.createdAt,
			updatedAt: post.updatedAt,
			authorName: post.author.nickname,
			authorUuid: post.author.minecraftUuid,
			commentCount: post._count.comments,
			userLiked: likedPostIds.includes(post.id),
		}));

		// 페이지네이션 메타데이터
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
		// 인증 확인은 middleware에서 처리되므로 여기서는 생략 가능
		// 하지만 명시적으로 체크하려면 auth() 호출
		const body = await request.json();
		const { title, content, tags, authorId } = body;

		if (!title || !content || !authorId) {
			return NextResponse.json({ error: 'Title, content, and authorId are required' }, { status: 400 });
		}

		// 게시글 생성
		const post = await prisma.post.create({
			data: {
				title,
				content,
				tags: JSON.stringify(tags || []),
				authorId,
			},
		});

		return NextResponse.json({
			success: true,
			message: 'Post created successfully',
			postId: post.id,
		});
	} catch (error) {
		console.error('[API] POST /api/posts error:', error);
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
	}
}

