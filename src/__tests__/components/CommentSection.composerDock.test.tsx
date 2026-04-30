import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CommentSection from "@/components/comments/CommentSection";

const scrollToBottomMock = vi.fn();
const scrollToCommentElementMock = vi.fn();
const mockState = vi.hoisted(() => ({
	useSessionMock: vi.fn(() => ({ data: null })),
	commentItemPropsMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
	useSession: mockState.useSessionMock,
}));

vi.mock("lucide-react", () => ({
	Pin: () => null,
}));

vi.mock("@/components/ui/useToast", () => ({
	useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/lib/realtime/useRealtimeBroadcast", () => ({
	useRealtimeBroadcast: () => undefined,
}));

vi.mock("@/components/ui/Modal", () => ({
	Modal: () => null,
}));

vi.mock("@/components/comments/CommentItem", () => ({
	default: (props: { canPin?: boolean }) => {
		mockState.commentItemPropsMock(props);
		return <div data-testid="comment-item" />;
	},
}));

vi.mock("@/components/comments/PinnedCommentsModal", () => ({
	default: () => null,
}));

vi.mock("@/components/comments/CommentDateDividerRow", () => ({
	default: () => null,
}));

vi.mock("@/components/comments/ReadMarkerRow", () => ({
	default: () => null,
}));

vi.mock("@/components/comments/ThreadToggleRow", () => ({
	default: () => null,
}));

vi.mock("@/components/comments/CommentForm", () => ({
	default: () => <div data-testid="comment-form" />,
}));

vi.mock("@/components/comments/useCommentScroll", () => ({
	useCommentScroll: () => ({
		scrollToBottom: scrollToBottomMock,
		scrollToCommentElement: scrollToCommentElementMock,
	}),
}));

vi.mock("@/components/comments/useCommentMutations", () => ({
	useCommentMutations: () => ({
		isLoading: false,
		handleCommentCreate: vi.fn(),
		handleCommentUpdate: vi.fn(),
		handleCommentDeleteConfirmed: vi.fn(),
		handleCommentPinToggle: vi.fn(),
	}),
}));

class ResizeObserverMock {
	private callback: ResizeObserverCallback;

	constructor(callback: ResizeObserverCallback) {
		this.callback = callback;
	}

	observe() {
		this.callback([], this as unknown as ResizeObserver);
	}

	unobserve() {}

	disconnect() {}
}

function installIdleSupport() {
	const idleQueue: IdleRequestCallback[] = [];
	vi.stubGlobal(
		"requestIdleCallback",
		vi.fn((callback: IdleRequestCallback) => {
			idleQueue.push(callback);
			return idleQueue.length;
		})
	);
	vi.stubGlobal("cancelIdleCallback", vi.fn());
	return {
		async flushIdle() {
			await act(async () => {
				for (const callback of idleQueue.splice(0, idleQueue.length)) {
					callback({
						didTimeout: false,
						timeRemaining: () => 50,
					} as IdleDeadline);
				}
				await Promise.resolve();
			});
		},
	};
}

describe("CommentSection composer dock", () => {
	const originalResizeObserver = globalThis.ResizeObserver;
	const originalInnerWidth = window.innerWidth;

	afterEach(() => {
		Object.defineProperty(globalThis, "ResizeObserver", { value: originalResizeObserver, configurable: true });
		Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, configurable: true });
		window.history.replaceState(null, "", "/");
		scrollToBottomMock.mockReset();
		scrollToCommentElementMock.mockReset();
		mockState.useSessionMock.mockReset();
		mockState.useSessionMock.mockReturnValue({ data: null });
		mockState.commentItemPropsMock.mockReset();
		vi.restoreAllMocks();
	});

	it("포스트 작성자 세션이면 댓글 아이템에 고정 권한을 전달해야 함", () => {
		mockState.useSessionMock.mockReturnValue({
			data: { user: { id: "7", role: "user" } },
		});
		Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });

		render(
			<CommentSection
				postId={1}
				postAuthorId={7}
				initialComments={[
					{
						id: 50,
						content: "current",
						createdAt: "2026-03-10T00:00:00.000Z",
						updatedAt: "2026-03-10T00:00:00.000Z",
						isPinned: false,
						parentId: null,
						isPostAuthor: false,
						author: { id: 2, nickname: "commenter", minecraftUuid: null, role: "user" },
						replies: [],
					},
				]}
			/>
		);

		expect(mockState.commentItemPropsMock).toHaveBeenCalledWith(expect.objectContaining({ canPin: true }));
	});

	it("포스트 작성자가 아닌 일반 사용자면 댓글 아이템에 고정 권한을 전달하지 않아야 함", () => {
		mockState.useSessionMock.mockReturnValue({
			data: { user: { id: "8", role: "user" } },
		});
		Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });

		render(
			<CommentSection
				postId={1}
				postAuthorId={7}
				initialComments={[
					{
						id: 50,
						content: "current",
						createdAt: "2026-03-10T00:00:00.000Z",
						updatedAt: "2026-03-10T00:00:00.000Z",
						isPinned: false,
						parentId: null,
						isPostAuthor: false,
						author: { id: 2, nickname: "commenter", minecraftUuid: null, role: "user" },
						replies: [],
					},
				]}
			/>
		);

		expect(mockState.commentItemPropsMock).toHaveBeenCalledWith(expect.objectContaining({ canPin: false }));
	});

	it("헤더 좌우 인셋을 측정해서 composer-dock 좌우를 맞춰야 함", async () => {
		const rafCallbacks: FrameRequestCallback[] = [];
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
		Object.defineProperty(window, "innerWidth", { value: 1200, configurable: true });
		Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
			const element = this as HTMLElement;
			if (element.classList?.contains("comment-section-header")) {
				return {
					left: 100,
					right: 900,
					top: 0,
					bottom: 0,
					width: 800,
					height: 40,
					x: 100,
					y: 0,
					toJSON: () => ({}),
				} as DOMRect;
			}
			return {
				left: 0,
				right: 0,
				top: 0,
				bottom: 0,
				width: 0,
				height: 0,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			} as DOMRect;
		});

		const { container } = render(<CommentSection postId={1} initialComments={[]} />);
		await act(async () => {
			for (const cb of rafCallbacks.splice(0, rafCallbacks.length)) {
				cb(0);
			}
		});

		const dock = container.querySelector(".composer-dock") as HTMLDivElement | null;
		expect(dock).toBeTruthy();
		expect(dock?.style.left).toBe("100px");
		expect(dock?.style.right).toBe("300px");
	});

	it("모바일에서는 헤더 인셋 대신 전체 폭 기준으로 composer-dock을 유지해야 함", async () => {
		const rafCallbacks: FrameRequestCallback[] = [];
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
		Object.defineProperty(window, "innerWidth", { value: 390, configurable: true });
		Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(() => ({
			left: 48,
			right: 342,
			top: 0,
			bottom: 0,
			width: 294,
			height: 40,
			x: 48,
			y: 0,
			toJSON: () => ({}),
		}) as DOMRect);

		const { container } = render(<CommentSection postId={1} initialComments={[]} />);
		await act(async () => {
			for (const cb of rafCallbacks.splice(0, rafCallbacks.length)) {
				cb(0);
			}
		});

		const dock = container.querySelector(".composer-dock") as HTMLDivElement | null;
		expect(dock).toBeTruthy();
		expect(dock?.style.left).toBe("");
		expect(dock?.style.right).toBe("");
	});

	it("retries comment jump after initial fresh reload brings target comment", async () => {
		const rafCallbacks: FrameRequestCallback[] = [];
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
		Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });
		window.history.replaceState(null, "", "/posts/1?commentId=99#comment-99");

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				comments: [
					{
						id: 1,
						content: "root",
						createdAt: "2026-03-10T00:00:00.000Z",
						updatedAt: "2026-03-10T00:00:00.000Z",
						isPinned: false,
						parentId: null,
						isPostAuthor: false,
						author: { id: 1, nickname: "writer", minecraftUuid: null, role: "user" },
						replies: [
							{
								id: 99,
								content: "target",
								createdAt: "2026-03-10T00:01:00.000Z",
								updatedAt: "2026-03-10T00:01:00.000Z",
								isPinned: false,
								parentId: 1,
								isPostAuthor: false,
								author: { id: 2, nickname: "alice", minecraftUuid: null, role: "user" },
								replies: [],
							},
						],
					},
				],
			}),
		});
		vi.stubGlobal("fetch", fetchMock);

		render(
			<CommentSection
				postId={1}
				initialComments={[]}
				readMarker={{ lastReadCommentCount: 0, totalCommentCount: 1 }}
			/>
		);

		for (let i = 0; i < 5; i += 1) {
			await act(async () => {
				for (const cb of rafCallbacks.splice(0, rafCallbacks.length)) {
					cb(0);
				}
				await Promise.resolve();
			});
		}

		expect(fetchMock).toHaveBeenCalledWith("/api/posts/1/comments?limit=12", { cache: "no-store" });
		await waitFor(() => {
			expect(scrollToCommentElementMock).toHaveBeenCalledWith(99, true, expect.any(Function));
		});
	});

	it("plain detail unread refresh에서는 최신 페이지로 다시 불러오고 최종적으로 맨 아래를 다시 맞춰야 함", async () => {
		const idle = installIdleSupport();
		const rafCallbacks: FrameRequestCallback[] = [];
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
		Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });
		window.history.replaceState(null, "", "/posts/1");

		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				comments: [
					{
						id: 10,
						content: "latest root",
						createdAt: "2026-03-10T00:10:00.000Z",
						updatedAt: "2026-03-10T00:10:00.000Z",
						isPinned: false,
						parentId: null,
						isPostAuthor: false,
						author: { id: 1, nickname: "writer", minecraftUuid: null, role: "user" },
						replies: [],
					},
				],
				page: {
					limit: 12,
					nextCursor: 10,
					hasMore: true,
				},
			}),
		});
		vi.stubGlobal("fetch", fetchMock);

		render(
			<CommentSection
				postId={1}
				initialComments={[
					{
						id: 9,
						content: "initial root",
						createdAt: "2026-03-10T00:09:00.000Z",
						updatedAt: "2026-03-10T00:09:00.000Z",
						isPinned: false,
						parentId: null,
						isPostAuthor: false,
						author: { id: 1, nickname: "writer", minecraftUuid: null, role: "user" },
						replies: [],
					},
				]}
				initialCommentsPage={{ limit: 12, nextCursor: 9, hasMore: true }}
				readMarker={{ lastReadCommentCount: 0, totalCommentCount: 20 }}
			/>
		);

		expect(fetchMock).not.toHaveBeenCalled();

		await idle.flushIdle();
		for (let i = 0; i < 5; i += 1) {
			await act(async () => {
				for (const cb of rafCallbacks.splice(0, rafCallbacks.length)) {
					cb(0);
				}
				await Promise.resolve();
			});
		}

		expect(fetchMock).toHaveBeenCalledWith("/api/posts/1/comments?limit=12", { cache: "no-store" });
		await waitFor(() => {
			expect(scrollToBottomMock).toHaveBeenCalledWith("auto");
		});
		expect(scrollToCommentElementMock).not.toHaveBeenCalled();
	});

	it("latest-window refresh가 no-op이면 맨 아래 재동기화를 다시 요청하지 않아야 함", async () => {
		const idle = installIdleSupport();
		const rafCallbacks: FrameRequestCallback[] = [];
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
		Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });
		window.history.replaceState(null, "", "/posts/1");

		const initialComments = [
			{
				id: 9,
				content: "initial root",
				createdAt: "2026-03-10T00:09:00.000Z",
				updatedAt: "2026-03-10T00:09:00.000Z",
				isPinned: false,
				parentId: null,
				isPostAuthor: false,
				author: { id: 1, nickname: "writer", minecraftUuid: null, role: "user" },
				replies: [],
			},
		];
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				comments: initialComments,
				page: {
					limit: 12,
					nextCursor: 9,
					hasMore: true,
				},
			}),
		});
		vi.stubGlobal("fetch", fetchMock);

		render(
			<CommentSection
				postId={1}
				initialComments={initialComments}
				initialCommentsPage={{ limit: 12, nextCursor: 9, hasMore: true }}
				readMarker={{ lastReadCommentCount: 0, totalCommentCount: 20 }}
			/>
		);

		await idle.flushIdle();
		for (let i = 0; i < 5; i += 1) {
			await act(async () => {
				for (const cb of rafCallbacks.splice(0, rafCallbacks.length)) {
					cb(0);
				}
				await Promise.resolve();
			});
		}

		expect(fetchMock).toHaveBeenCalledWith("/api/posts/1/comments?limit=12", { cache: "no-store" });
		expect(scrollToBottomMock).not.toHaveBeenCalled();
	});

	it("renders comment rows with the full-width interactive row class", () => {
		Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });
		const { container } = render(
			<CommentSection
				postId={1}
				initialComments={[
					{
						id: 1,
						content: "comment",
						createdAt: "2026-03-10T00:00:00.000Z",
						updatedAt: "2026-03-10T00:00:00.000Z",
						isPinned: false,
						parentId: null,
						isPostAuthor: false,
						author: { id: 1, nickname: "writer", minecraftUuid: null, role: "user" },
						replies: [],
					},
				]}
			/>
		);

		expect(container.querySelector(".comment-row.comment-interactive-row")).toBeTruthy();
		expect(container.querySelector(".comment-wrapper")?.getAttribute("style") ?? "").not.toContain("flex");
	});

	it("위로 스크롤해서 이전 댓글 버튼 근처에 왔을 때만 이전 댓글을 자동 로드하고 위치를 유지해야 함", async () => {
		Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });
		let documentHeight = 1000;
		Object.defineProperty(document.documentElement, "scrollHeight", {
			configurable: true,
			get: () => documentHeight,
		});
		Object.defineProperty(window, "scrollY", { value: 500, configurable: true, writable: true });
		const windowScrollToMock = vi.fn();
		vi.spyOn(window, "scrollTo").mockImplementation(windowScrollToMock as typeof window.scrollTo);
		const rafCallbacks: FrameRequestCallback[] = [];
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
			rafCallbacks.push(cb);
			return rafCallbacks.length;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
			const element = this as HTMLElement;
			if (element.classList?.contains("older-loader")) {
				return {
					left: 0,
					right: 100,
					top: 120,
					bottom: 160,
					width: 100,
					height: 40,
					x: 0,
					y: 120,
					toJSON: () => ({}),
				} as DOMRect;
			}
			return {
				left: 0,
				right: 0,
				top: 0,
				bottom: 0,
				width: 0,
				height: 0,
				x: 0,
				y: 0,
				toJSON: () => ({}),
			} as DOMRect;
		});
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => {
				documentHeight = 1400;
				return {
					comments: [
						{
							id: 40,
							content: "older",
							createdAt: "2026-03-09T00:00:00.000Z",
							updatedAt: "2026-03-09T00:00:00.000Z",
							isPinned: false,
							parentId: null,
							isPostAuthor: false,
							author: { id: 2, nickname: "older", minecraftUuid: null, role: "user" },
							replies: [],
						},
					],
					page: {
						limit: 12,
						nextCursor: 40,
						hasMore: false,
					},
				};
			},
		});
		vi.stubGlobal("fetch", fetchMock);

		render(
			<CommentSection
				postId={1}
				initialComments={[
					{
						id: 50,
						content: "current",
						createdAt: "2026-03-10T00:00:00.000Z",
						updatedAt: "2026-03-10T00:00:00.000Z",
						isPinned: false,
						parentId: null,
						isPostAuthor: false,
						author: { id: 1, nickname: "writer", minecraftUuid: null, role: "user" },
						replies: [],
					},
				]}
				initialCommentsPage={{ limit: 12, nextCursor: 50, hasMore: true }}
			/>
		);

		await act(async () => {
			Object.defineProperty(window, "scrollY", { value: 450, configurable: true, writable: true });
			fireEvent.scroll(window);
			await Promise.resolve();
		});
		await act(async () => {
			for (const cb of rafCallbacks.splice(0, rafCallbacks.length)) {
				cb(0);
			}
			await Promise.resolve();
		});

		expect(fetchMock).toHaveBeenCalledWith("/api/posts/1/comments?limit=12&cursor=50", {
			cache: "no-store",
		});
		expect(windowScrollToMock).toHaveBeenCalledWith({ top: 850, behavior: "auto" });
	});

	it("아래로 스크롤하거나 같은 cursor가 이미 자동 요청된 상태면 이전 댓글을 자동으로 반복 로드하지 않아야 함", async () => {
		Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock, configurable: true });
		Object.defineProperty(window, "scrollY", { value: 400, configurable: true, writable: true });
		vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
			const element = this as HTMLElement;
			return {
				left: 0,
				right: 100,
				top: element.classList?.contains("older-loader") ? 100 : 0,
				bottom: element.classList?.contains("older-loader") ? 140 : 0,
				width: 100,
				height: 40,
				x: 0,
				y: element.classList?.contains("older-loader") ? 100 : 0,
				toJSON: () => ({}),
			} as DOMRect;
		});
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				comments: [
					{
						id: 40,
						content: "older",
						createdAt: "2026-03-09T00:00:00.000Z",
						updatedAt: "2026-03-09T00:00:00.000Z",
						isPinned: false,
						parentId: null,
						isPostAuthor: false,
						author: { id: 2, nickname: "older", minecraftUuid: null, role: "user" },
						replies: [],
					},
				],
				page: {
					limit: 12,
					nextCursor: 50,
					hasMore: true,
				},
			}),
		});
		vi.stubGlobal("fetch", fetchMock);

		render(
			<CommentSection
				postId={1}
				initialComments={[
					{
						id: 50,
						content: "current",
						createdAt: "2026-03-10T00:00:00.000Z",
						updatedAt: "2026-03-10T00:00:00.000Z",
						isPinned: false,
						parentId: null,
						isPostAuthor: false,
						author: { id: 1, nickname: "writer", minecraftUuid: null, role: "user" },
						replies: [],
					},
				]}
				initialCommentsPage={{ limit: 12, nextCursor: 50, hasMore: true }}
			/>
		);

		await act(async () => {
			Object.defineProperty(window, "scrollY", { value: 430, configurable: true, writable: true });
			fireEvent.scroll(window);
			await Promise.resolve();
		});
		expect(fetchMock).not.toHaveBeenCalled();

		await act(async () => {
			Object.defineProperty(window, "scrollY", { value: 380, configurable: true, writable: true });
			fireEvent.scroll(window);
			await Promise.resolve();
		});
		await act(async () => {
			Object.defineProperty(window, "scrollY", { value: 360, configurable: true, writable: true });
			fireEvent.scroll(window);
			await Promise.resolve();
		});

		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
