import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, waitFor } from "@testing-library/react";

vi.mock("@/components/ui/ImageLightboxProvider", () => {
	return {
		useImageLightbox: () => ({ openImage: vi.fn() }),
	};
});

describe("PostContent external preview hydration", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

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
	});

	it("keeps existing meta chips when hydrated preview has no chips", async () => {
		const fetchMock = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					preview: {
						title: "partial-title",
						subtitle: "partial-subtitle",
						chips: [],
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { default: PostContent } = await import("@/components/posts/PostContent");
		const markdown = "[link](https://github.com/vercel/next.js/issues/2)";
		const view = render(<PostContent content={markdown} />);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		await waitFor(() => {
			const chips = view.container.querySelectorAll(".external-link-card__meta-chip");
			expect(chips.length).toBeGreaterThan(0);
			expect(chips[0]?.textContent).toContain("타입");
		});
	});

	it("falls back to icon thumbnail when preview image fails", async () => {
		const fetchMock = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					preview: {
						title: "fallback-check",
						subtitle: "subtitle",
						imageUrl: "https://broken.example.com/thumb.png",
						iconUrl: "https://valid.example.com/icon.png",
						chips: ["chip-a"],
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { default: PostContent } = await import("@/components/posts/PostContent");
		const markdown = "[link](https://github.com/vercel/next.js/issues/3)";
		const view = render(<PostContent content={markdown} />);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		await waitFor(() => {
			const thumb = view.container.querySelector<HTMLImageElement>(".external-link-card__thumb");
			const icon = view.container.querySelector<HTMLImageElement>(".external-link-card__icon");
			expect(thumb?.getAttribute("src")).toBe("https://broken.example.com/thumb.png");
			expect(icon?.getAttribute("src")).toBe("https://valid.example.com/icon.png");
		});

		const thumb = view.container.querySelector<HTMLImageElement>(".external-link-card__thumb");
		if (!thumb) {
			throw new Error("thumbnail node is missing");
		}
		fireEvent.error(thumb);

		await waitFor(() => {
			expect(thumb.getAttribute("src")).toBe("https://valid.example.com/icon.png");
			expect(thumb.style.display).not.toBe("none");
		});
	});
});
