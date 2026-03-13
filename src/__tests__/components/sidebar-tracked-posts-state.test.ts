import { describe, expect, it } from "vitest";

import {
	applyTrackedPostNotification,
	applyTrackedPostReadMarker,
	mergeFallbackWithServerTrackedPosts,
} from "@/components/layout/sidebar-tracked-posts-state";
import type { SidebarTrackedPost } from "@/types/sidebar";

function buildTrackedPost(overrides: Partial<SidebarTrackedPost> = {}): SidebarTrackedPost {
	return {
		postId: 1,
		title: "alpha",
		href: "/posts/1",
		board: "develope",
		serverAddress: null,
		lastActivityAt: "2026-03-06T00:00:00.000Z",
		author: {
			nickname: "alice",
			minecraftUuid: null,
		},
		sourceFlags: {
			authored: false,
			subscribed: true,
		},
		isSubscribed: true,
		commentCount: 3,
		newCommentCount: 0,
		latestCommentId: 10,
		...overrides,
	};
}

describe("sidebar-tracked-posts-state", () => {
	it("fallback과 서버 항목이 겹치면 서버 값을 우선해야 함", () => {
		const merged = mergeFallbackWithServerTrackedPosts(
			[
				buildTrackedPost({
					commentCount: 1,
					newCommentCount: 0,
					latestCommentId: null,
					lastActivityAt: "2026-03-05T00:00:00.000Z",
				}),
			],
			[
				buildTrackedPost({
					commentCount: 8,
					newCommentCount: 4,
					latestCommentId: 77,
					lastActivityAt: "2026-03-06T12:00:00.000Z",
				}),
			]
		);

		expect(merged).toHaveLength(1);
		expect(merged[0]).toMatchObject({
			commentCount: 8,
			newCommentCount: 4,
			latestCommentId: 77,
			lastActivityAt: "2026-03-06T12:00:00.000Z",
		});
	});

	it("post_comment 알림은 최신 댓글 id와 카운트를 즉시 반영해야 함", () => {
		const updated = applyTrackedPostNotification([buildTrackedPost()], {
			postId: 1,
			commentId: 99,
			occurredAt: "2026-03-07T00:00:00.000Z",
		});

		expect(updated[0]).toMatchObject({
			commentCount: 4,
			newCommentCount: 1,
			latestCommentId: 99,
			lastActivityAt: "2026-03-07T00:00:00.000Z",
		});
	});

	it("읽음 마커 갱신은 unread 카운트만 재계산해야 함", () => {
		const updated = applyTrackedPostReadMarker([buildTrackedPost({ newCommentCount: 4 })], {
			postId: 1,
			totalCommentCount: 10,
			lastReadCommentCount: 8,
		});

		expect(updated[0]?.newCommentCount).toBe(2);
		expect(updated[0]?.commentCount).toBe(3);
	});
});
