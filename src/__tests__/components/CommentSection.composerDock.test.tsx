import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CommentSection from "@/components/comments/CommentSection";

vi.mock("next-auth/react", () => ({
	useSession: () => ({ data: null }),
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
	default: () => null,
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
		scrollToBottom: vi.fn(),
		scrollToCommentElement: vi.fn(),
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

describe("CommentSection composer dock", () => {
	const originalResizeObserver = globalThis.ResizeObserver;
	const originalInnerWidth = window.innerWidth;

	afterEach(() => {
		Object.defineProperty(globalThis, "ResizeObserver", { value: originalResizeObserver, configurable: true });
		Object.defineProperty(window, "innerWidth", { value: originalInnerWidth, configurable: true });
		vi.restoreAllMocks();
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
});
