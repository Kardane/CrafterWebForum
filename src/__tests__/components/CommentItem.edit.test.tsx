import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
		vi.unstubAllGlobals();
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
		expect(styleTag?.textContent).toContain(".comment-wrapper.toolbar-active .comment-item");
		expect(styleTag?.textContent).toContain(".comment-wrapper.toolbar-active .comment-actions");
		expect(styleTag?.textContent).toContain("@media (hover: none)");
		expect(styleTag?.textContent).toContain("min-height: 42px");
		expect(styleTag?.textContent).toContain("min-height: 38px");
		expect(styleTag?.textContent).toContain("flex: 1 1 auto");
	});

	it("keeps toolbar active while moving from row to actions", async () => {
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

		fireEvent.mouseEnter(actions);

		expect(wrapper.className).toContain("toolbar-active");
	});

	it("마우스가 댓글을 벗어나면 툴바가 즉시 닫혀야 함", async () => {
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
		fireEvent.mouseEnter(wrapper);
		expect(wrapper.className).toContain("toolbar-active");

		fireEvent.mouseLeave(wrapper);
		expect(wrapper.className).not.toContain("toolbar-active");
	});

	it("복사 직후 suppression이 걸렸다가 다시 해제되어야 함", async () => {
		vi.useFakeTimers();
		vi.stubGlobal("navigator", {
			clipboard: {
				writeText: vi.fn().mockResolvedValue(undefined),
			},
		});
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
		fireEvent.click(screen.getByTitle("텍스트 복사"));

		await act(async () => {
			await Promise.resolve();
		});
		expect(actions.className).toContain("suppressed");

		await act(async () => {
			vi.advanceTimersByTime(750);
			await Promise.resolve();
		});
		expect(actions.className).not.toContain("suppressed");
	});
});
