import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import React from "react";

vi.mock("@/components/ui/ImageLightboxProvider", () => {
	return {
		useImageLightbox: () => ({ openImage: vi.fn() }),
	};
});

describe("PostContent external preview hydration", () => {
	it("dedupes /api/link-preview fetches across multiple instances", async () => {
		const fetchMock = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					preview: {
						badge: "GitHub",
						title: "enriched-title",
						subtitle: "enriched-subtitle",
						chips: ["chip-a"],
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { default: PostContent } = await import("@/components/posts/PostContent");
		const markdown = "[link](https://github.com/vercel/next.js/issues/1)";

		const view = render(
			<div>
				<PostContent content={markdown} />
				<PostContent content={markdown} />
			</div>
		);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		await waitFor(() => {
			expect(view.container.querySelectorAll(".external-link-card__title")[0]?.textContent).toBe("enriched-title");
			expect(view.container.querySelectorAll(".external-link-card__title")[1]?.textContent).toBe("enriched-title");
		});

		vi.unstubAllGlobals();
	});
});
