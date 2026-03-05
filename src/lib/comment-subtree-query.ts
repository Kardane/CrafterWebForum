import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface RawCommentWithAuthorRow {
	id: number;
	postId: number;
	authorId: number;
	content: string;
	isPinned: number;
	parentId: number | null;
	createdAt: Date;
	updatedAt: Date;
	authorNickname: string;
	authorMinecraftUuid: string | null;
	authorRole: string;
}

export interface CommentWithAuthorRow {
	id: number;
	postId: number;
	authorId: number;
	content: string;
	isPinned: number;
	parentId: number | null;
	createdAt: Date;
	updatedAt: Date;
	author: {
		id: number;
		nickname: string;
		minecraftUuid: string | null;
		role: string;
	};
}

export async function fetchCommentSubtreeRowsByRootIds(postId: number, rootIds: number[]): Promise<CommentWithAuthorRow[]> {
	if (rootIds.length === 0) {
		return [];
	}

	const rootIdValues = rootIds.filter((id) => Number.isInteger(id) && id > 0);
	if (rootIdValues.length === 0) {
		return [];
	}

	const rootIdsSql = Prisma.join(rootIdValues.map((id) => Prisma.sql`${id}`));
	const rows = await prisma.$queryRaw<RawCommentWithAuthorRow[]>(Prisma.sql`
		WITH RECURSIVE comment_tree AS (
			SELECT
				c.id,
				c."postId",
				c."authorId",
				c.content,
				c."isPinned",
				c."parentId",
				c."createdAt",
				c."updatedAt"
			FROM "Comment" c
			WHERE c."postId" = ${postId}
			  AND c.id IN (${rootIdsSql})

			UNION ALL

			SELECT
				child.id,
				child."postId",
				child."authorId",
				child.content,
				child."isPinned",
				child."parentId",
				child."createdAt",
				child."updatedAt"
			FROM "Comment" child
			INNER JOIN comment_tree parent ON child."parentId" = parent.id
			WHERE child."postId" = ${postId}
		)
		SELECT
			t.id,
			t."postId",
			t."authorId",
			t.content,
			t."isPinned",
			t."parentId",
			t."createdAt",
			t."updatedAt",
			u.nickname AS "authorNickname",
			u."minecraftUuid" AS "authorMinecraftUuid",
			u.role AS "authorRole"
		FROM comment_tree t
		INNER JOIN "User" u ON u.id = t."authorId"
		ORDER BY t.id ASC
	`);

	return rows.map((row) => ({
		id: row.id,
		postId: row.postId,
		authorId: row.authorId,
		content: row.content,
		isPinned: row.isPinned,
		parentId: row.parentId,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		author: {
			id: row.authorId,
			nickname: row.authorNickname,
			minecraftUuid: row.authorMinecraftUuid,
			role: row.authorRole,
		},
	}));
}
