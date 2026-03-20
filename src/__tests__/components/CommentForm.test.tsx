import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/useToast", () => ({
	useToast: () => ({
		showToast: vi.fn(),
	}),
}));

vi.mock("@/components/poll/PollModal", () => ({
	default: ({
		isOpen,
		onSubmit,
	}: {
		isOpen: boolean;
		onSubmit: (pollData: {
			question: string;
			options: Array<{ id: number; text: string; votes: number }>;
			settings: { duration_hours: number; allow_multi: boolean; created_at: string };
			voters: Record<string, number[]>;
		}) => void;
	}) =>
		isOpen ? (
			<button
				type="button"
				onClick={() =>
					onSubmit({
						question: "질문",
						options: [
							{ id: 0, text: "A", votes: 0 },
							{ id: 1, text: "B", votes: 0 },
						],
						settings: {
							duration_hours: 24,
							allow_multi: false,
							created_at: "2026-03-15T00:00:00.000Z",
						},
						voters: {},
					})
				}
			>
				모의 투표 생성
			</button>
		) : null,
}));

describe("CommentForm", () => {
	it("submit 진행 중에는 Enter를 반복 눌러도 onSubmit을 한 번만 호출해야 함", async () => {
		const onSubmit = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					setTimeout(resolve, 50);
				})
		);
		const { default: CommentForm } = await import("@/components/comments/CommentForm");

		render(<CommentForm onSubmit={onSubmit} initialValue="edited" mode="edit" />);

		const textarea = screen.getByDisplayValue("edited");
		fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false, nativeEvent: { isComposing: false } });
		fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false, nativeEvent: { isComposing: false } });

		expect(onSubmit).toHaveBeenCalledTimes(1);

		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 60));
		});
	});

	it("투표 생성 완료 시 raw text만 남기지 않고 즉시 onSubmit을 호출해야 함", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const { default: CommentForm } = await import("@/components/comments/CommentForm");

		render(<CommentForm onSubmit={onSubmit} postId={11} />);

		fireEvent.click(screen.getByRole("button", { name: "" }));
		fireEvent.click(screen.getByText("투표 만들기"));
		fireEvent.click(screen.getByText("모의 투표 생성"));

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
		expect(onSubmit.mock.calls[0][0]).toContain("[POLL_JSON]");
	});

	it("composer variant는 모바일 폭을 위해 textarea와 액션 행을 같이 렌더링해야 함", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const { default: CommentForm } = await import("@/components/comments/CommentForm");

		const { container } = render(<CommentForm onSubmit={onSubmit} variant="composer" postId={11} />);

		expect(container.querySelector(".comment-form.composer")).toBeTruthy();
		expect(container.querySelector(".form-input-wrapper")).toBeTruthy();
		expect(container.querySelector(".comment-textarea")).toBeTruthy();
		expect(container.querySelector(".submit-btn")).toBeTruthy();
	});

	it("composer variant는 모바일에서 도구모음 버튼 줄을 textarea 위로 올리는 스타일을 포함해야 함", async () => {
		const onSubmit = vi.fn().mockResolvedValue(undefined);
		const { default: CommentForm } = await import("@/components/comments/CommentForm");

		const { container } = render(<CommentForm onSubmit={onSubmit} variant="composer" postId={11} />);
		const styleText = container.querySelector("style")?.textContent ?? "";

		expect(styleText).toContain('grid-template-areas:');
		expect(styleText).toContain('"tools tools"');
		expect(styleText).toContain('"textarea submit"');
		expect(styleText).toContain(".comment-form.composer .plus-btn-wrapper");
	});
});
