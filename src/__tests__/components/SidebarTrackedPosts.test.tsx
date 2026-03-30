import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { showToastMock, realtimeState } = vi.hoisted(() => ({
	showToastMock: vi.fn(),
	realtimeState: {
		handlers: {} as Record<string, (payload: Record<string, unknown>) => void>,
	},
}));
const pathnameState = vi.hoisted(() => ({
	value: "/posts/1",
}));

vi.mock("next/link", () => ({
	default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("next/navigation", () => ({
	usePathname: () => pathnameState.value,
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
	useRealtimeBroadcast: (_topic: string | null, handlers: Record<string, (payload: Record<string, unknown>) => void>) => {
		realtimeState.handlers = handlers;
	},
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

type IdleTask = IdleRequestCallback;

function installIdleSupport() {
	const callbacks: IdleTask[] = [];
	const requestIdleCallbackMock = vi.fn((callback: IdleTask) => {
		callbacks.push(callback);
		return callbacks.length;
	});
	const cancelIdleCallbackMock = vi.fn((handle: number) => {
		callbacks.splice(handle - 1, 1);
	});

	vi.stubGlobal("requestIdleCallback", requestIdleCallbackMock);
	vi.stubGlobal("cancelIdleCallback", cancelIdleCallbackMock);

	const flushNextIdleTask = async () => {
		const callback = callbacks.shift();
		if (!callback) {
			return;
		}
		await act(async () => {
			callback({
				didTimeout: false,
				timeRemaining: () => 50,
			} as IdleDeadline);
			await Promise.resolve();
		});
	};

	return {
		requestIdleCallbackMock,
		cancelIdleCallbackMock,
		flushNextIdleTask,
	};
}

async function renderSidebarTrackedPosts() {
	const { default: SidebarTrackedPosts } = await import("@/components/layout/SidebarTrackedPosts");
	const view = render(<SidebarTrackedPosts />);
	return {
		SidebarTrackedPosts,
		...view,
	};
}

describe("SidebarTrackedPosts", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
		showToastMock.mockReset();
		realtimeState.handlers = {};
		pathnameState.value = "/posts/1";
		window.localStorage.clear();
	});

	it("구독을 끄면 작성한 글이어도 서버 재조회 후 목록에서 제거해야 함", async () => {
		const { flushNextIdleTask } = installIdleSupport();
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

		await renderSidebarTrackedPosts();
		expect(fetchMock).not.toHaveBeenCalled();
		await flushNextIdleTask();

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

	it("초기 fetch는 idle 이후 시작하고 pathname 변경 재조회는 200ms debounce 해야 함", async () => {
		vi.useFakeTimers();
		const { requestIdleCallbackMock, flushNextIdleTask } = installIdleSupport();
		const fetchMock = vi.fn().mockImplementation(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						items: [trackedPost],
						page: { nextCursor: null, hasMore: false },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			)
		);
		vi.stubGlobal("fetch", fetchMock);

		const view = await renderSidebarTrackedPosts();

		expect(fetchMock).not.toHaveBeenCalled();
		expect(requestIdleCallbackMock).toHaveBeenCalledTimes(1);

		await flushNextIdleTask();
		await act(async () => {
			await Promise.resolve();
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);

		pathnameState.value = "/posts/2";
		await act(async () => {
			view.rerender(<view.SidebarTrackedPosts />);
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
		await act(async () => {
			vi.advanceTimersByTime(199);
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
		await act(async () => {
			vi.advanceTimersByTime(1);
			await Promise.resolve();
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
		vi.useRealTimers();
	});

	it("fallbackLocalOnly 응답에서도 구독을 끄면 즉시 제거해야 함", async () => {
		const { flushNextIdleTask } = installIdleSupport();
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

		await renderSidebarTrackedPosts();
		await flushNextIdleTask();

		await screen.findByText("alpha");

		fireEvent.click(screen.getByTitle("포스트 알림 끄기"));

		await waitFor(() => {
			expect(screen.queryByText("alpha")).toBeNull();
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("fallback 로컬 구독 목록은 새로 마운트해도 유지해야 함", async () => {
		const { flushNextIdleTask } = installIdleSupport();
		const fetchMock = vi.fn().mockImplementation(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						items: [],
						page: { nextCursor: null, hasMore: false },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			)
		);
		vi.stubGlobal("fetch", fetchMock);

		const firstView = await renderSidebarTrackedPosts();
		await flushNextIdleTask();

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/sidebar/tracked-posts?limit=30",
				expect.objectContaining({ cache: "no-store" })
			);
		});

		act(() => {
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
		});

		await screen.findByText("alpha");
		firstView.unmount();

		await renderSidebarTrackedPosts();
		await flushNextIdleTask();

		await waitFor(() => {
			expect(screen.getByText("alpha")).toBeTruthy();
		});
		expect(JSON.parse(window.localStorage.getItem("sidebarTrackedPostsFallback:7") ?? "[]")).toHaveLength(1);
	});

	it("fallback 로컬 구독 목록은 서버 응답이 비어 있어도 refresh 후 유지해야 함", async () => {
		const { flushNextIdleTask } = installIdleSupport();
		window.localStorage.setItem(
			"sidebarTrackedPostsFallback:7",
			JSON.stringify([
				{
					...trackedPost,
					lastActivityAt: "2026-03-05T00:00:00.000Z",
				},
			])
		);

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

		await renderSidebarTrackedPosts();
		await flushNextIdleTask();

		await waitFor(() => {
			expect(screen.getByText("alpha")).toBeTruthy();
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"/api/sidebar/tracked-posts?limit=30",
			expect.objectContaining({ cache: "no-store" })
		);
	});

	it("새 댓글이 있는 포스트는 노란색 하이라이트 클래스가 적용되어야 함", async () => {
		const { flushNextIdleTask } = installIdleSupport();
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

		await renderSidebarTrackedPosts();
		await flushNextIdleTask();

		const noNewComments = await screen.findByText("no new comments");
		const hasNewComments = await screen.findByText("has new comments");

		const noNewCommentsContainer = noNewComments.closest(".flex.items-start.gap-2.rounded.border");
		const hasNewCommentsContainer = hasNewComments.closest(".flex.items-start.gap-2.rounded.border");

		expect(noNewCommentsContainer).not.toHaveClass("bg-yellow-500/10");
		expect(hasNewCommentsContainer).toHaveClass("bg-yellow-500/10");
	});

	it("같은 포스트가 fallback과 서버에 함께 있으면 서버 최신 상태를 우선해야 함", async () => {
		const { flushNextIdleTask } = installIdleSupport();
		window.localStorage.setItem(
			"sidebarTrackedPostsFallback:7",
			JSON.stringify([
				{
					...trackedPost,
					commentCount: 1,
					newCommentCount: 0,
					latestCommentId: null,
					lastActivityAt: "2026-03-05T00:00:00.000Z",
				},
			])
		);

		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [
						{
							...trackedPost,
							commentCount: 8,
							newCommentCount: 4,
							latestCommentId: 77,
							lastActivityAt: "2026-03-06T12:00:00.000Z",
						},
					],
					page: { nextCursor: null, hasMore: false },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			)
		);
		vi.stubGlobal("fetch", fetchMock);

		await renderSidebarTrackedPosts();
		await flushNextIdleTask();

		await waitFor(() => {
			const link = screen.getByRole("link", { name: /alpha/i });
			expect(link).toHaveAttribute("href", "/posts/1?commentId=77#comment-77");
		});
		expect(screen.getByText("4")).toBeTruthy();
		expect(screen.getByText("8")).toBeTruthy();
	});

	it("post_comment realtime 수신 후 즉시 갱신하고 1회 재조회로 최신 상태에 수렴해야 함", async () => {
		const { flushNextIdleTask } = installIdleSupport();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [
							{
								...trackedPost,
								commentCount: 3,
								newCommentCount: 0,
								latestCommentId: 50,
							},
						],
						page: { nextCursor: null, hasMore: false },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [
							{
								...trackedPost,
								commentCount: 4,
								newCommentCount: 1,
								latestCommentId: 99,
							},
						],
						page: { nextCursor: null, hasMore: false },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			);
		vi.stubGlobal("fetch", fetchMock);

		await renderSidebarTrackedPosts();
		await flushNextIdleTask();

		await screen.findByText("alpha");

		await act(async () => {
			realtimeState.handlers["notification.created"]?.({
				type: "post_comment",
				postId: 1,
				commentId: 99,
			});
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(screen.getByText("1")).toBeTruthy();
		});

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(2);
			const link = screen.getByRole("link", { name: /alpha/i });
			expect(link).toHaveAttribute("href", "/posts/1?commentId=99#comment-99");
		});
	});

	it("post_comment realtime 이후 서버 재조회 unread가 0이어도 노란 하이라이트를 유지해야 함", async () => {
		const { flushNextIdleTask } = installIdleSupport();
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [{ ...trackedPost, commentCount: 3, newCommentCount: 0, latestCommentId: 50 }],
						page: { nextCursor: null, hasMore: false },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			)
			.mockResolvedValueOnce(
				new Response(
					JSON.stringify({
						items: [{ ...trackedPost, commentCount: 4, newCommentCount: 0, latestCommentId: 50 }],
						page: { nextCursor: null, hasMore: false },
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				)
			);
		vi.stubGlobal("fetch", fetchMock);

		await renderSidebarTrackedPosts();
		await flushNextIdleTask();

		const title = await screen.findByText("alpha");

		await act(async () => {
			realtimeState.handlers["notification.created"]?.({
				type: "post_comment",
				postId: 1,
				commentId: 99,
			});
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(screen.getByText("1")).toBeTruthy();
		});

		await waitFor(() => {
			const container = title.closest(".flex.items-start.gap-2.rounded.border");
			expect(container).toHaveClass("bg-yellow-500/10");
			const link = screen.getByRole("link", { name: /alpha/i });
			expect(link).toHaveAttribute("href", "/posts/1?commentId=99#comment-99");
		});
	});

	it("읽음 이벤트를 받으면 하이라이트를 해제해야 함", async () => {
		const { flushNextIdleTask } = installIdleSupport();
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [{ ...trackedPost, commentCount: 4, newCommentCount: 1, latestCommentId: 99 }],
					page: { nextCursor: null, hasMore: false },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			)
		);
		vi.stubGlobal("fetch", fetchMock);

		await renderSidebarTrackedPosts();
		await flushNextIdleTask();

		const title = await screen.findByText("alpha");

		await act(async () => {
			realtimeState.handlers["post.readMarker.updated"]?.({
				postId: 1,
				totalCommentCount: 4,
				lastReadCommentCount: 4,
			});
			await Promise.resolve();
		});

		await waitFor(() => {
			const container = title.closest(".flex.items-start.gap-2.rounded.border");
			expect(container).not.toHaveClass("bg-yellow-500/10");
		});
	});

	it("구독 목록 내부에는 별도 스크롤 클래스가 없어야 함", async () => {
		const { flushNextIdleTask } = installIdleSupport();
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(
				JSON.stringify({
					items: [trackedPost],
					page: { nextCursor: null, hasMore: false },
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			)
		);
		vi.stubGlobal("fetch", fetchMock);

		const { container } = await renderSidebarTrackedPosts();
		await flushNextIdleTask();

		await screen.findByText("alpha");

		expect(container.querySelector(".overflow-y-auto")).toBeNull();
	});
});
