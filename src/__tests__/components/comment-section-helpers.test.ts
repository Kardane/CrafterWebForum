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
	it("returns true when unread comments exist", () => {
		expect(
			shouldRefreshCommentsOnMount({
				initialComments: [makeComment(1)],
				lastReadCommentCount: 1,
				totalCommentCount: 2,
				targetCommentId: null,
			})
		).toBe(true);
	});

	it("returns true when target comment is missing from initial payload", () => {
		expect(
			shouldRefreshCommentsOnMount({
				initialComments: [makeComment(1)],
				lastReadCommentCount: 1,
				totalCommentCount: 1,
				targetCommentId: 99,
			})
		).toBe(true);
	});

	it("returns false when payload already contains target and unread count is synced", () => {
		expect(
			shouldRefreshCommentsOnMount({
				initialComments: [makeComment(1, [makeComment(99)])],
				lastReadCommentCount: 2,
				totalCommentCount: 2,
				targetCommentId: 99,
			})
		).toBe(false);
	});
});
