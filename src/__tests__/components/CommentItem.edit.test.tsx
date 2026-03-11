import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
	useSession: () => ({ data: { user: { id: "7", role: "user" } } }),
}));

vi.mock("@/components/ui/useToast", () => ({
	useToast: () => ({
		showToast: vi.fn(),
	}),
}));

vi.mock("@/components/ui/ImageLightboxProvider", () => ({
	useImageLightbox: () => ({ openImage: vi.fn() }),
}));

describe("CommentItem edit behavior", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps edit mode open when onEdit rejects", async () => {
		const onEdit = vi.fn().mockRejectedValue(new Error("update failed"));
		const { default: CommentItem } = await import("@/components/comments/CommentItem");

		render(
			<CommentItem
				comment={{
					id: 101,
					content: "original comment",
					createdAt: "2026-03-06T00:00:00.000Z",
					updatedAt: "2026-03-06T00:00:00.000Z",
					isPinned: false,
					parentId: null,
					isPostAuthor: false,
					author: {
						id: 7,
						nickname: "alice",
						minecraftUuid: null,
						role: "user",
					},
					replies: [],
				}}
				onReplyRequest={vi.fn()}
				onEdit={onEdit}
				onDelete={vi.fn()}
			/>
		);

		fireEvent.click(screen.getByTitle("수정"));
		const textarea = await screen.findByDisplayValue("original comment");
		fireEvent.change(textarea, { target: { value: "edited comment" } });
		fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false, nativeEvent: { isComposing: false } });

		await waitFor(() => {
			expect(onEdit).toHaveBeenCalledWith(101, "edited comment");
		});
		expect(screen.getByPlaceholderText("댓글을 수정해줘")).toBeTruthy();
		expect(screen.getByRole("button", { name: "취소" })).toBeTruthy();
	});

	it("includes full comment row hover selector in styles", async () => {
		const { default: CommentItem } = await import("@/components/comments/CommentItem");
		const { container } = render(
			<CommentItem
				comment={{
					id: 101,
					content: "original comment",
					createdAt: "2026-03-06T00:00:00.000Z",
					updatedAt: "2026-03-06T00:00:00.000Z",
					isPinned: false,
					parentId: null,
					isPostAuthor: false,
					author: {
						id: 7,
						nickname: "alice",
						minecraftUuid: null,
						role: "user",
					},
					replies: [],
				}}
				onReplyRequest={vi.fn()}
				onEdit={vi.fn()}
				onDelete={vi.fn()}
			/>
		);

		const styleTag = container.querySelector("style");
		expect(styleTag?.textContent).toContain(":global(.comment-interactive-row:hover) .comment-item");
		expect(styleTag?.textContent).toContain(":global(.comment-interactive-row:hover) .comment-actions");
		expect(styleTag?.textContent).toContain("flex: 1 1 auto");
	});

	it("keeps toolbar active while moving from row to actions", async () => {
		vi.useFakeTimers();
		const { default: CommentItem } = await import("@/components/comments/CommentItem");
		const { container } = render(
			<CommentItem
				comment={{
					id: 101,
					content: "original comment",
					createdAt: "2026-03-06T00:00:00.000Z",
					updatedAt: "2026-03-06T00:00:00.000Z",
					isPinned: false,
					parentId: null,
					isPostAuthor: false,
					author: {
						id: 7,
						nickname: "alice",
						minecraftUuid: null,
						role: "user",
					},
					replies: [],
				}}
				onReplyRequest={vi.fn()}
				onEdit={vi.fn()}
				onDelete={vi.fn()}
			/>
		);

		const wrapper = container.querySelector(".comment-wrapper") as HTMLDivElement;
		const actions = container.querySelector(".comment-actions") as HTMLDivElement;

		fireEvent.mouseEnter(wrapper);
		expect(wrapper.className).toContain("toolbar-active");

		fireEvent.mouseLeave(wrapper);
		fireEvent.mouseEnter(actions);
		vi.advanceTimersByTime(150);

		expect(wrapper.className).toContain("toolbar-active");
	});
});
