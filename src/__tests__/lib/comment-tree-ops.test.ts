import { describe, expect, it } from "vitest";
import {
	appendReplyToThread,
	mergeLatestWindowComments,
	updateCommentInTree,
	removeCommentFromTree,
	updateCommentPinnedInTree,
	getReadMarkerIndex,
	parseCommentIdFromElementId,
	type Comment,
} from "@/lib/comment-tree-ops";

// 테스트용 댓글 생성 헬퍼
function makeComment(overrides: Partial<Comment> & { id: number }): Comment {
	return {
		content: `comment-${overrides.id}`,
		createdAt: "2026-01-01T00:00:00Z",
		updatedAt: "2026-01-01T00:00:00Z",
		isPinned: false,
		parentId: null,
		isPostAuthor: false,
		author: { id: 1, nickname: "user", minecraftUuid: null, role: "user" },
		replies: [],
		...overrides,
	};
}

describe("appendReplyToThread", () => {
	it("루트 댓글의 replies 끝에 답글 추가", () => {
		const root = makeComment({ id: 1 });
		const reply = makeComment({ id: 2, parentId: 1 });
		const result = appendReplyToThread([root], 1, reply);

		expect(result[0].replies).toHaveLength(1);
		expect(result[0].replies[0].id).toBe(2);
	});

	it("원본 배열 불변 유지", () => {
		const root = makeComment({ id: 1 });
		const reply = makeComment({ id: 2, parentId: 1 });
		const original = [root];
		appendReplyToThread(original, 1, reply);

		expect(original[0].replies).toHaveLength(0);
	});

	it("대상 루트가 없으면 트리 그대로 반환", () => {
		const root = makeComment({ id: 1 });
		const reply = makeComment({ id: 2, parentId: 999 });
		const result = appendReplyToThread([root], 999, reply);

		expect(result[0].replies).toHaveLength(0);
	});

	it("이미 답글이 있는 루트에 추가 가능", () => {
		const existing = makeComment({ id: 2, parentId: 1 });
		const root = makeComment({ id: 1, replies: [existing] });
		const newReply = makeComment({ id: 3, parentId: 1 });
		const result = appendReplyToThread([root], 1, newReply);

		expect(result[0].replies).toHaveLength(2);
		expect(result[0].replies[1].id).toBe(3);
	});
});

describe("updateCommentInTree", () => {
	it("루트 댓글의 content 업데이트", () => {
		const root = makeComment({ id: 1 });
		const result = updateCommentInTree([root], 1, "updated", "2026-02-01T00:00:00Z");

		expect(result[0].content).toBe("updated");
		expect(result[0].updatedAt).toBe("2026-02-01T00:00:00Z");
	});

	it("중첩된 답글의 content 업데이트", () => {
		const reply = makeComment({ id: 2, parentId: 1 });
		const root = makeComment({ id: 1, replies: [reply] });
		const result = updateCommentInTree([root], 2, "edited", "2026-02-01T00:00:00Z");

		expect(result[0].replies[0].content).toBe("edited");
	});

	it("원본 불변 유지", () => {
		const root = makeComment({ id: 1 });
		const original = [root];
		updateCommentInTree(original, 1, "new", "2026-02-01T00:00:00Z");

		expect(original[0].content).toBe("comment-1");
	});
});

describe("removeCommentFromTree", () => {
	it("루트 댓글 제거", () => {
		const nodes = [makeComment({ id: 1 }), makeComment({ id: 2 })];
		const result = removeCommentFromTree(nodes, 1);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe(2);
	});

	it("중첩 답글 제거", () => {
		const reply = makeComment({ id: 2, parentId: 1 });
		const root = makeComment({ id: 1, replies: [reply] });
		const result = removeCommentFromTree([root], 2);

		expect(result[0].replies).toHaveLength(0);
	});

	it("없는 ID 제거 시 원본 길이 유지", () => {
		const nodes = [makeComment({ id: 1 })];
		const result = removeCommentFromTree(nodes, 999);

		expect(result).toHaveLength(1);
	});
});

describe("updateCommentPinnedInTree", () => {
	it("루트 댓글 핀 상태 변경", () => {
		const root = makeComment({ id: 1 });
		const result = updateCommentPinnedInTree([root], 1, true);

		expect(result[0].isPinned).toBe(true);
	});

	it("중첩 답글 핀 상태 변경", () => {
		const reply = makeComment({ id: 2, parentId: 1 });
		const root = makeComment({ id: 1, replies: [reply] });
		const result = updateCommentPinnedInTree([root], 2, true);

		expect(result[0].replies[0].isPinned).toBe(true);
	});

	it("핀 해제", () => {
		const root = makeComment({ id: 1, isPinned: true });
		const result = updateCommentPinnedInTree([root], 1, false);

		expect(result[0].isPinned).toBe(false);
	});
});

describe("mergeLatestWindowComments", () => {
	it("latest window의 새 루트 댓글과 답글을 기존 트리에 병합", () => {
		const existing = [
			makeComment({
				id: 1,
				replies: [makeComment({ id: 2, parentId: 1 })],
			}),
		];
		const incoming = [
			makeComment({
				id: 1,
				replies: [
					makeComment({ id: 2, parentId: 1 }),
					makeComment({ id: 3, parentId: 1 }),
				],
			}),
			makeComment({ id: 4 }),
		];

		const result = mergeLatestWindowComments(existing, incoming);

		expect(result.shouldFallbackToFullReload).toBe(false);
		expect(result.didChange).toBe(true);
		expect(result.comments).toHaveLength(2);
		expect(result.comments[0].replies.map((reply) => reply.id)).toEqual([2, 3]);
		expect(result.comments[1].id).toBe(4);
	});

	it("병합할 새 댓글이 없으면 no-op이어야 함", () => {
		const existing = [
			makeComment({
				id: 1,
				replies: [makeComment({ id: 2, parentId: 1 })],
			}),
		];
		const incoming = [
			makeComment({
				id: 1,
				replies: [makeComment({ id: 2, parentId: 1 })],
			}),
		];

		const result = mergeLatestWindowComments(existing, incoming);

		expect(result.shouldFallbackToFullReload).toBe(false);
		expect(result.didChange).toBe(false);
		expect(result.comments).toEqual(existing);
	});

	it("parent를 찾을 수 없는 최신 window 구조면 full reload fallback을 요구해야 함", () => {
		const existing = [makeComment({ id: 1 })];
		const incoming = [
			makeComment({
				id: 1,
				replies: [makeComment({ id: 3, parentId: 999 })],
			}),
		];

		const result = mergeLatestWindowComments(existing, incoming);

		expect(result.shouldFallbackToFullReload).toBe(true);
	});
});

describe("getReadMarkerIndex", () => {
	it("정상: total > lastReadCommentCount → lastReadCommentCount 반환", () => {
		expect(getReadMarkerIndex(10, 5)).toBe(5);
	});

	it("모두 읽음: lastReadCommentCount >= total → null", () => {
		expect(getReadMarkerIndex(5, 5)).toBeNull();
		expect(getReadMarkerIndex(5, 10)).toBeNull();
	});

	it("빈 댓글: total <= 0 → null", () => {
		expect(getReadMarkerIndex(0, 0)).toBeNull();
	});

	it("읽음 카운트 0 → null", () => {
		expect(getReadMarkerIndex(10, 0)).toBeNull();
	});
});

describe("parseCommentIdFromElementId", () => {
	it("정상 파싱: 'comment-123' → 123", () => {
		expect(parseCommentIdFromElementId("comment-123")).toBe(123);
	});

	it("부정 숫자 → null", () => {
		expect(parseCommentIdFromElementId("comment-0")).toBeNull();
		expect(parseCommentIdFromElementId("comment--1")).toBeNull();
	});

	it("비숫자 문자열 → null", () => {
		expect(parseCommentIdFromElementId("comment-abc")).toBeNull();
		expect(parseCommentIdFromElementId("")).toBeNull();
	});

	it("접두사 없는 순수 숫자 → 파싱", () => {
		expect(parseCommentIdFromElementId("42")).toBe(42);
	});
});
