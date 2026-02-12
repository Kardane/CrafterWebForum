import { describe, expect, it } from "vitest";
import { flattenCommentsForStream, type StreamComment } from "@/lib/comment-stream";

interface CommentOverrides {
	id: number;
	authorId: number;
	authorName?: string;
	createdAt: string;
	content?: string;
	isPinned?: boolean;
	parentId?: number | null;
	replies?: StreamComment[];
}

function makeComment({
	id,
	authorId,
	authorName,
	createdAt,
	content = "본문",
	isPinned = false,
	parentId = null,
	replies = [],
}: CommentOverrides): StreamComment {
	return {
		id,
		content,
		createdAt,
		isPinned,
		parentId,
		author: {
			id: authorId,
			nickname: authorName ?? `user-${authorId}`,
		},
		replies,
	};
}

describe("flattenCommentsForStream", () => {
	it("같은 작성자가 연속 작성하면 compact 처리함", () => {
		const comments = [
			makeComment({
				id: 1,
				authorId: 1,
				createdAt: "2026-02-08T00:00:00.000Z",
			}),
			makeComment({
				id: 2,
				authorId: 1,
				createdAt: "2026-02-08T00:03:00.000Z",
			}),
		];

		const flattened = flattenCommentsForStream(comments);

		expect(flattened.map((item) => item.comment.id)).toEqual([1, 2]);
		expect(flattened[0].isCompact).toBe(false);
		expect(flattened[1].isCompact).toBe(true);
	});

	it("작성자 사이에 다른 댓글이 끼면 compact 처리하지 않음", () => {
		const comments = [
			makeComment({
				id: 1,
				authorId: 1,
				createdAt: "2026-02-08T00:00:00.000Z",
			}),
			makeComment({
				id: 2,
				authorId: 2,
				createdAt: "2026-02-08T00:01:00.000Z",
			}),
			makeComment({
				id: 3,
				authorId: 1,
				createdAt: "2026-02-08T00:02:00.000Z",
			}),
		];

		const flattened = flattenCommentsForStream(comments);

		expect(flattened[2].comment.id).toBe(3);
		expect(flattened[2].isCompact).toBe(false);
	});

	it("5분 초과하면 compact 처리하지 않음", () => {
		const comments = [
			makeComment({
				id: 1,
				authorId: 1,
				createdAt: "2026-02-08T00:00:00.000Z",
			}),
			makeComment({
				id: 2,
				authorId: 1,
				createdAt: "2026-02-08T00:06:00.000Z",
			}),
		];

		const flattened = flattenCommentsForStream(comments);

		expect(flattened[1].isCompact).toBe(false);
	});

	it("고정 댓글은 compact 체인을 끊음", () => {
		const comments = [
			makeComment({
				id: 1,
				authorId: 1,
				createdAt: "2026-02-08T00:00:00.000Z",
			}),
			makeComment({
				id: 2,
				authorId: 1,
				isPinned: true,
				createdAt: "2026-02-08T00:01:00.000Z",
			}),
			makeComment({
				id: 3,
				authorId: 1,
				createdAt: "2026-02-08T00:02:00.000Z",
			}),
		];

		const flattened = flattenCommentsForStream(comments);

		expect(flattened[1].isCompact).toBe(false);
		expect(flattened[2].isCompact).toBe(false);
	});

	it("연속 compact 체인은 최대 5개로 제한됨", () => {
		const comments = Array.from({ length: 7 }, (_, index) =>
			makeComment({
				id: index + 1,
				authorId: 1,
				createdAt: `2026-02-08T00:0${index}:00.000Z`,
			})
		);

		const flattened = flattenCommentsForStream(comments);

		expect(flattened.map((item) => item.isCompact)).toEqual([
			false,
			true,
			true,
			true,
			true,
			false,
			true,
		]);
	});

	it("답글이 포함된 연속 댓글은 compact 처리하지 않음", () => {
		const comments = [
			makeComment({
				id: 1,
				authorId: 1,
				createdAt: "2026-02-08T00:00:00.000Z",
			}),
			makeComment({
				id: 2,
				authorId: 1,
				parentId: 1,
				createdAt: "2026-02-08T00:01:00.000Z",
			}),
			makeComment({
				id: 3,
				authorId: 1,
				createdAt: "2026-02-08T00:02:00.000Z",
			}),
		];

		const flattened = flattenCommentsForStream(comments);
		expect(flattened.map((item) => item.isCompact)).toEqual([false, false, false]);
	});
});
