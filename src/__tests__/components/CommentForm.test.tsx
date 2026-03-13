import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/ui/useToast", () => ({
	useToast: () => ({
		showToast: vi.fn(),
	}),
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
});
