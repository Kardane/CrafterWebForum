import { describe, expect, it } from "vitest";

import { shouldRefreshCommentsOnMount } from "@/components/comments/comment-section-helpers";
import type { Comment } from "@/lib/comment-tree-ops";

function makeComment(id: number, replies: Comment[] = []): Comment {
	return {
		id,
		content: `comment-${id}`,
		createdAt: "2026-03-10T00:00:00.000Z",
		updatedAt: "2026-03-10T00:00:00.000Z",
		isPinned: false,
		parentId: null,
		isPostAuthor: false,
		author: {
			id: 1,
			nickname: "writer",
			minecraftUuid: null,
			role: "user",
		},
		replies,
	};
}

describe("shouldRefreshCommentsOnMount", () => {
	it("일반 상세에서 unread 댓글 차이만 있으면 latest-window refresh를 반환해야 함", () => {
		expect(
			shouldRefreshCommentsOnMount({
				initialComments: [makeComment(1)],
				lastReadCommentCount: 1,
				totalCommentCount: 2,
				targetCommentId: null,
			})
		).toBe("latest-window");
	});

	it("target comment가 초기 payload에 없으면 full refresh를 반환해야 함", () => {
		expect(
			shouldRefreshCommentsOnMount({
				initialComments: [makeComment(1)],
				lastReadCommentCount: 1,
				totalCommentCount: 1,
				targetCommentId: 99,
			})
		).toBe("full");
	});

	it("payload가 이미 최신 상태면 refresh를 하지 않아야 함", () => {
		expect(
			shouldRefreshCommentsOnMount({
				initialComments: [makeComment(1, [makeComment(99)])],
				lastReadCommentCount: 2,
				totalCommentCount: 2,
				targetCommentId: 99,
			})
		).toBe("none");
	});
});
