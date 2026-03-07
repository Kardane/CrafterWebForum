import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data: {
			user: {
				id: "7",
			},
		},
	}),
}));

describe("PostSubscriptionButton", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		window.localStorage.clear();
	});

	it("fallback 구독 정보가 있으면 새로고침 후에도 구독 상태로 보여야 함", async () => {
		window.localStorage.setItem(
			"sidebarTrackedPostsFallback:7",
			JSON.stringify([
				{
					postId: 11,
					title: "alpha",
					href: "/posts/11",
					lastActivityAt: "2026-03-07T00:00:00.000Z",
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
					latestCommentId: null,
				},
			])
		);

		const { default: PostSubscriptionButton } = await import("@/components/posts/PostSubscriptionButton");
		render(
			<PostSubscriptionButton
				postId={11}
				initialSubscribed={false}
				sidebarFallbackItem={{
					title: "alpha",
					href: "/posts/11",
					author: { nickname: "alice", minecraftUuid: null },
					commentCount: 3,
					latestCommentId: null,
				}}
			/>
		);

		await waitFor(() => {
			expect(screen.getByTitle("포스트 알림 끄기")).toBeTruthy();
		});
	});

	it("fallbackLocalOnly로 구독 해제하면 로컬 fallback도 제거해야 함", async () => {
		window.localStorage.setItem(
			"sidebarTrackedPostsFallback:7",
			JSON.stringify([
				{
					postId: 11,
					title: "alpha",
					href: "/posts/11",
					lastActivityAt: "2026-03-07T00:00:00.000Z",
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
					latestCommentId: null,
				},
			])
		);

		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ fallbackLocalOnly: true, enabled: false }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			})
		);
		vi.stubGlobal("fetch", fetchMock);

		const { default: PostSubscriptionButton } = await import("@/components/posts/PostSubscriptionButton");
		render(
			<PostSubscriptionButton
				postId={11}
				initialSubscribed={false}
				sidebarFallbackItem={{
					title: "alpha",
					href: "/posts/11",
					author: { nickname: "alice", minecraftUuid: null },
					commentCount: 3,
					latestCommentId: null,
				}}
			/>
		);

		fireEvent.click(screen.getByTitle("포스트 알림 끄기"));

		await waitFor(() => {
			expect(screen.getByTitle("포스트 알림 켜기")).toBeTruthy();
		});
		expect(window.localStorage.getItem("sidebarTrackedPostsFallback:7")).toBeNull();
	});
});
