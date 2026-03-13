import { act, render, waitFor } from "@testing-library/react";
import { useLayoutEffect, useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const {
	readPostDetailScrollStateMock,
	clearPostDetailScrollStateMock,
	savePostDetailScrollStateMock,
} = vi.hoisted(() => ({
	readPostDetailScrollStateMock: vi.fn(),
	clearPostDetailScrollStateMock: vi.fn(),
	savePostDetailScrollStateMock: vi.fn(),
}));

vi.mock("@/lib/scroll-restore", () => ({
	readPostDetailScrollState: readPostDetailScrollStateMock,
	clearPostDetailScrollState: clearPostDetailScrollStateMock,
	savePostDetailScrollState: savePostDetailScrollStateMock,
}));

import { useCommentScroll } from "@/components/comments/useCommentScroll";

function TestHarness({ postId }: { postId: number }) {
	const streamRef = useRef<HTMLDivElement>(null);
	useCommentScroll({
		postId,
		streamRef,
		ensureCommentVisible: () => true,
		flattenedCommentsLength: 3,
	});

	useLayoutEffect(() => {
		if (!streamRef.current) {
			return;
		}
		Object.defineProperty(streamRef.current, "scrollHeight", { value: 480, configurable: true });
		Object.defineProperty(streamRef.current, "scrollTo", { value: vi.fn(), configurable: true });
	}, []);

	return (
		<div>
			<div data-testid="stream" ref={streamRef} />
			<div id="comment-feed-end" />
		</div>
	);
}

describe("useCommentScroll", () => {
	afterEach(() => {
		vi.restoreAllMocks();
		readPostDetailScrollStateMock.mockReset();
		clearPostDetailScrollStateMock.mockReset();
		savePostDetailScrollStateMock.mockReset();
		window.history.replaceState(null, "", "/");
	});

	it("기본 진입에서는 댓글 맨 아래로 스크롤해야 함", async () => {
		readPostDetailScrollStateMock.mockReturnValue(null);
		const scrollIntoViewMock = vi.fn();
		const windowScrollToMock = vi.fn();
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
			configurable: true,
			value: scrollIntoViewMock,
		});
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
			cb(0);
			return 1;
		});
		vi.spyOn(window, "scrollTo").mockImplementation(windowScrollToMock as typeof window.scrollTo);

		const view = render(<TestHarness postId={11} />);
		const stream = await waitFor(() => view.getByTestId("stream") as HTMLDivElement);

		await act(async () => {
			await Promise.resolve();
		});

		await waitFor(() => {
			expect(stream.scrollTo).toHaveBeenCalledWith({ top: 480, behavior: "auto" });
		});
		expect(scrollIntoViewMock).toHaveBeenCalled();
		expect(windowScrollToMock).toHaveBeenCalled();
	});

	it("commentId 진입에서는 기본 맨아래 스크롤을 건너뛰어야 함", async () => {
		readPostDetailScrollStateMock.mockReturnValue(null);
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
			configurable: true,
			value: vi.fn(),
		});
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
			cb(0);
			return 1;
		});
		const windowScrollToMock = vi.fn();
		vi.spyOn(window, "scrollTo").mockImplementation(windowScrollToMock as typeof window.scrollTo);
		window.history.replaceState(null, "", "/posts/11?commentId=99#comment-99");

		const view = render(<TestHarness postId={11} />);
		const stream = await waitFor(() => view.getByTestId("stream") as HTMLDivElement);

		await act(async () => {
			await Promise.resolve();
		});

		expect(stream.scrollTo).not.toHaveBeenCalled();
		expect(windowScrollToMock).not.toHaveBeenCalled();
	});

	it("commentId 진입에서는 저장된 스크롤 위치를 복원하지 않아야 함", async () => {
		readPostDetailScrollStateMock.mockReturnValue({
			anchorCommentId: null,
			scrollY: 320,
		});
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
			configurable: true,
			value: vi.fn(),
		});
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
			cb(0);
			return 1;
		});
		const windowScrollToMock = vi.fn();
		vi.spyOn(window, "scrollTo").mockImplementation(windowScrollToMock as typeof window.scrollTo);
		window.history.replaceState(null, "", "/posts/11?commentId=99#comment-99");

		render(<TestHarness postId={11} />);

		await act(async () => {
			await Promise.resolve();
		});

		expect(windowScrollToMock).not.toHaveBeenCalled();
		expect(clearPostDetailScrollStateMock).toHaveBeenCalledWith(11);
	});
});
