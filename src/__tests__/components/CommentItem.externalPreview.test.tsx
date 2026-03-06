import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

vi.mock("next-auth/react", () => ({
	useSession: () => ({ data: null }),
}));

vi.mock("@/components/ui/useToast", () => ({
	useToast: () => ({
		showToast: vi.fn(),
	}),
}));

vi.mock("@/components/ui/ImageLightboxProvider", () => ({
	useImageLightbox: () => ({ openImage: vi.fn() }),
}));

describe("CommentItem external preview hydration", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("hydrates github card metadata inside comments", async () => {
		const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			if (url.includes("/api/link-preview")) {
				return new Response(
					JSON.stringify({
						preview: {
							badge: "GitHub 이슈",
							title: "hydrated-comment-title",
							subtitle: "hydrated-comment-subtitle",
							authorName: "comment-author",
							chips: ["chip-in-comment"],
						},
					}),
					{ status: 200, headers: { "Content-Type": "application/json" } }
				);
			}
			return new Response(JSON.stringify({ items: [] }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		});
		vi.stubGlobal("fetch", fetchMock);

		const { default: CommentItem } = await import("@/components/comments/CommentItem");
		const comment = {
			id: 101,
			content: "[링크](https://github.com/vercel/next.js/issues/1)",
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
		};

		const view = render(
			<CommentItem
				comment={comment}
				onReplyRequest={vi.fn()}
				onEdit={vi.fn()}
				onDelete={vi.fn()}
			/>
		);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				expect.stringContaining("/api/link-preview?url="),
				expect.objectContaining({ cache: "force-cache" })
			);
		});

		await waitFor(() => {
			expect(view.container.querySelector(".external-link-card__title")?.textContent).toBe(
				"hydrated-comment-title"
			);
			expect(view.container.querySelector(".external-link-card__author-name")?.textContent).toBe(
				"comment-author"
			);
		});
	});
});
