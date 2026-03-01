import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	const normalizedTags = await prisma.post.updateMany({
		where: {
			tags: null,
		},
		data: {
			tags: "[]",
		},
	});

	const groupedCommentCounts = await prisma.comment.groupBy({
		by: ["postId"],
		_count: {
			_all: true,
		},
	});

	const countByPostId = new Map();
	for (const row of groupedCommentCounts) {
		countByPostId.set(row.postId, row._count._all);
	}

	const posts = await prisma.post.findMany({
		select: {
			id: true,
			commentCount: true,
		},
		orderBy: {
			id: "asc",
		},
	});

	let syncedPosts = 0;
	for (const post of posts) {
		const nextCount = countByPostId.get(post.id) ?? 0;
		if (post.commentCount === nextCount) {
			continue;
		}
		await prisma.post.update({
			where: {
				id: post.id,
			},
			data: {
				commentCount: nextCount,
			},
		});
		syncedPosts += 1;
	}

	console.log(
		JSON.stringify({
			normalizedTags: normalizedTags.count,
			syncedPosts,
			totalPosts: posts.length,
		})
	);
}

main()
	.catch((error) => {
		console.error("[backfill-post-comment-count] failed", error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
