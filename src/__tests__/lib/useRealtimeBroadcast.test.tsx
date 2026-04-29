import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRealtimeBroadcast } from "@/lib/realtime/useRealtimeBroadcast";

const subscribeMock = vi.fn();

vi.mock("@/lib/realtime/client", () => ({
	getRealtimeClient: () => ({
		subscribe: subscribeMock,
	}),
}));

function TestRealtimeSubscriber({
	topic,
	onCommentCreated,
}: {
	topic: string | null;
	onCommentCreated: (payload: Record<string, unknown>) => void;
}) {
	useRealtimeBroadcast(topic, {
		"comment.created": onCommentCreated,
	});
	return null;
}

describe("useRealtimeBroadcast", () => {
	beforeEach(() => {
		subscribeMock.mockReset();
	});

	it("기존 호출부 API로 client subscribe와 cleanup을 수행한다", () => {
		const unsubscribe = vi.fn();
		subscribeMock.mockReturnValue(unsubscribe);
		const firstHandler = vi.fn();
		const secondHandler = vi.fn();

		const { rerender, unmount } = render(
			<TestRealtimeSubscriber topic="post:1" onCommentCreated={firstHandler} />
		);
		const wrappedHandler = subscribeMock.mock.calls[0][2] as (payload: Record<string, unknown>) => void;
		wrappedHandler({ id: 1 });
		rerender(<TestRealtimeSubscriber topic="post:1" onCommentCreated={secondHandler} />);
		wrappedHandler({ id: 2 });
		unmount();

		expect(subscribeMock).toHaveBeenCalledWith("post:1", "comment.created", expect.any(Function));
		expect(firstHandler).toHaveBeenCalledWith({ id: 1 });
		expect(secondHandler).toHaveBeenCalledWith({ id: 2 });
		expect(unsubscribe).toHaveBeenCalledTimes(1);
	});

	it("topic이 없으면 구독하지 않는다", () => {
		render(<TestRealtimeSubscriber topic={null} onCommentCreated={vi.fn()} />);

		expect(subscribeMock).not.toHaveBeenCalled();
	});
});
