import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { showToastMock } = vi.hoisted(() => ({
	showToastMock: vi.fn(),
}));

vi.mock("next/link", () => ({
	default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("next/navigation", () => ({
	usePathname: () => "/posts/1",
}));

vi.mock("next-auth/react", () => ({
	useSession: () => ({
		data: {
			user: {
				id: "7",
			},
		},
	}),
}));

vi.mock("@/components/ui/useToast", () => ({
	useToast: () => ({
		showToast: showToastMock,
	}),
}));

vi.mock("@/lib/realtime/useRealtimeBroadcast", () => ({
	useRealtimeBroadcast: () => undefined,
}));

const trackedPost = {
	postId: 1,
	title: "alpha",
	href: "/posts/1",
	lastActivityAt: "2026-03-06T00:00:00.000Z",
	author: {
		nickname: "alice",
		minecraftUuid: null,
	},
	sourceFlags: {
		authored: true,
		subscribed: true,
	},
	isSubscribed: true,
	commentCount: 3,
	newCommentCount: 0,
	latestCommentId: null,
};

describe("SidebarTrackedPosts", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		showToastMock.mockReset();
		window.localStorage.clear();
	});

	it("구독을 끄면 작성한 글이어도 서버 재조회 후 목록에서 제거해야 함", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [trackedPost],
						page: { nextCursor: null, hasMore: false },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ fallbackLocalOnly: false }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				})
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [],
						page: { nextCursor: null, hasMore: false },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			);
		vi.stubGlobal("fetch", fetchMock);

		const { default: SidebarTrackedPosts } = await import("@/components/layout/SidebarTrackedPosts");
		render(<SidebarTrackedPosts />);

		await screen.findByText("alpha");

		fireEvent.click(screen.getByTitle("포스트 알림 끄기"));

		await waitFor(() => {
			expect(screen.queryByText("alpha")).toBeNull();
		});

		expect(fetchMock).toHaveBeenNthCalledWith(
			2,
			"/api/posts/1/subscription",
			expect.objectContaining({
				method: "PATCH",
			})
		);
		await waitFor(() => {
			expect(fetchMock).toHaveBeenNthCalledWith(
				3,
				"/api/sidebar/tracked-posts?limit=30",
				expect.objectContaining({ cache: "no-store" })
			);
		});
	});

	it("fallbackLocalOnly 응답에서도 구독을 끄면 즉시 제거해야 함", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [trackedPost],
						page: { nextCursor: null, hasMore: false },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ fallbackLocalOnly: true }), {
					status: 200,
					headers: { "Content-Type": "application/json" },
				})
			);
		vi.stubGlobal("fetch", fetchMock);

		const { default: SidebarTrackedPosts } = await import("@/components/layout/SidebarTrackedPosts");
		render(<SidebarTrackedPosts />);

		await screen.findByText("alpha");

		fireEvent.click(screen.getByTitle("포스트 알림 끄기"));

		await waitFor(() => {
			expect(screen.queryByText("alpha")).toBeNull();
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("fallback 로컬 구독 목록은 새로 마운트해도 유지해야 함", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [],
					page: { nextCursor: null, hasMore: false },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			)
		);
		vi.stubGlobal("fetch", fetchMock);

		const { default: SidebarTrackedPosts } = await import("@/components/layout/SidebarTrackedPosts");
		const firstView = render(<SidebarTrackedPosts />);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/sidebar/tracked-posts?limit=30",
				expect.objectContaining({ cache: "no-store" })
			);
		});

		window.dispatchEvent(
			new CustomEvent("sidebarTrackedPostsFallbackChanged", {
				detail: {
					postId: 1,
					enabled: true,
					item: {
						title: "alpha",
						href: "/posts/1",
						author: { nickname: "alice", minecraftUuid: null },
						commentCount: 3,
						latestCommentId: null,
					},
				},
			})
		);

		await screen.findByText("alpha");
		firstView.unmount();

		render(<SidebarTrackedPosts />);

		await waitFor(() => {
			expect(screen.getByText("alpha")).toBeTruthy();
		});
		expect(JSON.parse(window.localStorage.getItem("sidebarTrackedPostsFallback:7") ?? "[]")).toHaveLength(1);
	});

	it("새 댓글이 있는 포스트는 노란색 하이라이트 클래스가 적용되어야 함", async () => {
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [
						{ ...trackedPost, postId: 1, title: "no new comments", newCommentCount: 0 },
						{ ...trackedPost, postId: 2, title: "has new comments", newCommentCount: 5 },
					],
					page: { nextCursor: null, hasMore: false },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			)
		);
		vi.stubGlobal("fetch", fetchMock);

		const { default: SidebarTrackedPosts } = await import("@/components/layout/SidebarTrackedPosts");
		render(<SidebarTrackedPosts />);

		const noNewComments = await screen.findByText("no new comments");
		const hasNewComments = await screen.findByText("has new comments");

		const noNewCommentsContainer = noNewComments.closest(".flex.items-start.gap-2.rounded.border");
		const hasNewCommentsContainer = hasNewComments.closest(".flex.items-start.gap-2.rounded.border");

		expect(noNewCommentsContainer).not.toHaveClass("bg-yellow-500/10");
		expect(hasNewCommentsContainer).toHaveClass("bg-yellow-500/10");
	});
});
