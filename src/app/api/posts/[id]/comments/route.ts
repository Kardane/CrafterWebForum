import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildCommentTree } from "@/lib/comments";
import { getPostMutationTags, parsePostTags, safeRevalidateTags } from "@/lib/cache-tags";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";
import {
	enqueueCommentSideEffectJob,
	isMissingCommentSideEffectJobTableError,
	runCommentSideEffects,
} from "@/lib/comment-side-effects";
import { resolveActiveUserFromSession } from "@/lib/active-user";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";
import { fetchCommentSubtreeRowsByRootIds } from "@/lib/comment-subtree-query";
import { parsePostTagMetadata } from "@/lib/post-board";
import {
	isMissingPostBoardMetadataColumnError,
	isMissingPostCommentCountColumnError,
} from "@/lib/db-schema-guard";
import { z } from "zod";

const DEFAULT_COMMENT_ROOT_LIMIT = 20;
const MAX_COMMENT_ROOT_LIMIT = 50;

const commentAuthorSelect = {
	id: true,
	nickname: true,
	minecraftUuid: true,
	role: true,
} as const;

const commentIncludeWithAuthor = {
	author: {
		select: commentAuthorSelect,
	},
} as const;

async function loadCommentTargetPost(postId: number) {
	try {
		return await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
			select: {
				id: true,
				authorId: true,
				board: true,
				tags: true,
			},
		});
	} catch (error) {
		if (!isMissingPostBoardMetadataColumnError(error)) {
			throw error;
		}
		console.warn("[API] comments route post board columns missing; using legacy tag metadata fallback");
		const legacyPost = await prisma.post.findFirst({
			where: {
				id: postId,
				deletedAt: null,
			},
			select: {
				id: true,
				authorId: true,
				tags: true,
			},
		});
		if (!legacyPost) {
			return null;
		}
		return {
			...legacyPost,
			board: parsePostTagMetadata(legacyPost.tags, null, null).board,
		};
	}
}

const commentCreateBodySchema = z.object({
	content: z.string().trim().min(1),
	parentId: z
		.preprocess((value) => {
			if (value === null || value === undefined) {
				return null;
			}
			if (typeof value === "string" && value.trim().length === 0) {
				return Number.NaN;
			}
			return Number(value);
		}, z.number().int().positive().nullable())
		.optional(),
});


/**
 * GET /api/posts/[id]/comments
 * 댓글 목록 조회 (대댓글 포함)
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const { id } = await params;
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session, { requireApproved: false });
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}

		const postId = parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}

		const post = await loadCommentTargetPost(postId);

		if (!post) {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}
		if (post.board !== "sinmungo" && activeUser.context.isApproved !== 1) {
			return NextResponse.json({ error: "pending_approval" }, { status: 403 });
		}

		const searchParams = new URL(request.url).searchParams;
		const rawLimit = searchParams.get("limit");
		const rawCursor = searchParams.get("cursor");
		const usePagination = rawLimit !== null || rawCursor !== null;

		if (!usePagination) {
			const comments = await prisma.comment.findMany({
				where: {
					postId,
				},
				include: commentIncludeWithAuthor,
				orderBy: [{ createdAt: "asc" }],
			});
			const commentsWithPostAuthorFlag = comments.map((comment) => ({
				...comment,
				isPostAuthor: comment.author.id === post.authorId,
			}));

			return NextResponse.json({ comments: buildCommentTree(commentsWithPostAuthorFlag) });
		}

		const parsedLimit = rawLimit === null ? DEFAULT_COMMENT_ROOT_LIMIT : Number.parseInt(rawLimit, 10);
		if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
			return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
		}
		const limit = Math.min(parsedLimit, MAX_COMMENT_ROOT_LIMIT);

		let cursor: number | null = null;
		if (rawCursor !== null) {
			const parsedCursor = Number.parseInt(rawCursor, 10);
			if (!Number.isInteger(parsedCursor) || parsedCursor <= 0) {
				return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
			}
			cursor = parsedCursor;
		}

		const rootComments = await prisma.comment.findMany({
			where: {
				postId,
				parentId: null,
				...(cursor ? { id: { lt: cursor } } : {}),
			},
			include: commentIncludeWithAuthor,
			orderBy: [{ id: "desc" }],
			take: limit + 1,
		});

		const hasMore = rootComments.length > limit;
		const selectedRoots = hasMore ? rootComments.slice(0, limit) : rootComments;
		const nextCursor =
			hasMore && selectedRoots.length > 0
				? selectedRoots[selectedRoots.length - 1].id
				: null;

		const pagedComments = await fetchCommentSubtreeRowsByRootIds(
			postId,
			selectedRoots.map((root) => root.id)
		);
		const commentsWithPostAuthorFlag = pagedComments.map((comment) => ({
			...comment,
			isPostAuthor: comment.author.id === post.authorId,
		}));

		return NextResponse.json({
			comments: buildCommentTree(commentsWithPostAuthorFlag),
			page: {
				limit,
				nextCursor,
				hasMore,
			},
		});
	} catch (error) {
		console.error("[API] GET /api/posts/[id]/comments error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/posts/[id]/comments
 * 댓글 작성
 */
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const timing = {
			load_post: 0,
			validate_parent: 0,
			write_comment: 0,
			write_post_read: 0,
			enqueue_side_effect_job: 0,
		};
		const { id } = await params;
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session, { requireApproved: false });
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}
		const sessionUserId = activeUser.context.userId;

		const postId = parseInt(id, 10);
		if (Number.isNaN(postId)) {
			return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
		}

		const parsedBody = commentCreateBodySchema.safeParse(
			await readJsonBody(request, { maxBytes: 256 * 1024 })
		);
		if (!parsedBody.success) {
			const hasParentIdIssue = parsedBody.error.issues.some((issue) => issue.path[0] === "parentId");
			return NextResponse.json(
				{ error: hasParentIdIssue ? "Invalid parent comment ID" : "Content is required" },
				{ status: 400 }
			);
		}
		const content = parsedBody.data.content;
		const normalizedParentId = parsedBody.data.parentId ?? null;

		const loadPostStartedAt = Date.now();
		const post = await loadCommentTargetPost(postId);
		timing.load_post = Date.now() - loadPostStartedAt;

		if (!post) {
			return NextResponse.json({ error: "Post not found" }, { status: 404 });
		}
		if (post.board !== "sinmungo" && activeUser.context.isApproved !== 1) {
			return NextResponse.json({ error: "pending_approval" }, { status: 403 });
		}

		if (normalizedParentId !== null) {
			const validateParentStartedAt = Date.now();
			const parentComment = await prisma.comment.findFirst({
				where: {
					id: normalizedParentId,
					postId,
				},
			});

			if (!parentComment) {
				return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
			}
			timing.validate_parent = Date.now() - validateParentStartedAt;
		}

		let comment;
		let commentCount: number;
		const writeCommentStartedAt = Date.now();
		try {
			const [createdComment, updatedPost] = await prisma.$transaction([
				prisma.comment.create({
					data: {
						content,
						postId,
						authorId: sessionUserId,
						parentId: normalizedParentId,
					},
					include: commentIncludeWithAuthor,
				}),
				prisma.post.update({
					where: { id: postId },
					data: {
						updatedAt: new Date(),
						commentCount: {
							increment: 1,
						},
					},
					select: {
						commentCount: true,
					},
				}),
			]);
			comment = createdComment;
			commentCount = updatedPost.commentCount;
		} catch (error) {
			if (!isMissingPostCommentCountColumnError(error)) {
				throw error;
			}
			console.warn("[API] POST /api/posts/[id]/comments post commentCount column missing; using counted fallback");
			comment = await prisma.comment.create({
				data: {
					content,
					postId,
					authorId: sessionUserId,
					parentId: normalizedParentId,
				},
				include: commentIncludeWithAuthor,
			});
			await prisma.post.update({
				where: { id: postId },
				data: {
					updatedAt: new Date(),
				},
				select: {
					id: true,
				},
			});
			commentCount = await prisma.comment.count({
				where: {
					postId,
				},
			});
		}
		timing.write_comment = Date.now() - writeCommentStartedAt;

		const writePostReadStartedAt = Date.now();
		await prisma.postRead.upsert({
			where: {
				userId_postId: {
					userId: sessionUserId,
					postId,
				},
			},
			update: {
				lastReadCommentCount: commentCount,
				updatedAt: new Date(),
			},
			create: {
				userId: sessionUserId,
				postId,
				lastReadCommentCount: commentCount,
			},
		});
		timing.write_post_read = Date.now() - writePostReadStartedAt;
		safeRevalidateTags(
			getPostMutationTags({
				postId,
				tags: parsePostTags(post.tags),
			})
		);

		const actorNickname = activeUser.context.nickname || "누군가";
		const enqueueSideEffectStartedAt = Date.now();
		let sideEffectMode: "job" | "inline_fallback" = "job";
		try {
			await enqueueCommentSideEffectJob({
				commentId: comment.id,
				postId,
				actorUserId: sessionUserId,
				actorNickname,
				content,
			});
		} catch (error) {
			if (!isMissingCommentSideEffectJobTableError(error)) {
				throw error;
			}
			sideEffectMode = "inline_fallback";
			await runCommentSideEffects({
				commentId: comment.id,
				postId,
				actorUserId: sessionUserId,
				actorNickname,
				content,
			});
		}
		timing.enqueue_side_effect_job = Date.now() - enqueueSideEffectStartedAt;

		void broadcastRealtime({
			topic: REALTIME_TOPICS.post(postId),
			event: REALTIME_EVENTS.COMMENT_CREATED,
			payload: {
				postId,
				commentId: comment.id,
				parentId: comment.parentId,
				actorUserId: sessionUserId,
				comment: {
					id: comment.id,
					content: comment.content,
					createdAt: comment.createdAt,
					updatedAt: comment.updatedAt,
					isPinned: Boolean(comment.isPinned),
					parentId: comment.parentId,
					isPostAuthor: comment.author.id === post.authorId,
					author: {
						id: comment.author.id,
						nickname: comment.author.nickname,
						minecraftUuid: comment.author.minecraftUuid,
						role: comment.author.role,
					},
				},
			},
		});

		void broadcastRealtime({
			topic: REALTIME_TOPICS.user(sessionUserId),
			event: REALTIME_EVENTS.POST_READ_MARKER_UPDATED,
			payload: {
				postId,
				lastReadCommentCount: commentCount,
				totalCommentCount: commentCount,
			},
		});

		console.info("[comment-write] completed", {
			postId,
			commentId: comment.id,
			sideEffectMode,
			...timing,
		});

		return NextResponse.json({
			success: true,
			message: "Comment created successfully",
			comment: {
				id: comment.id,
				content: comment.content,
				createdAt: comment.createdAt,
				updatedAt: comment.updatedAt,
					isPinned: Boolean(comment.isPinned),
					parentId: comment.parentId,
					author: comment.author,
					isPostAuthor: comment.author.id === post.authorId,
					replies: [],
				},
			});
	} catch (error) {
		if (error instanceof JsonBodyError) {
			return NextResponse.json({ error: error.code }, { status: error.status });
		}
		console.error("[API] POST /api/posts/[id]/comments error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
