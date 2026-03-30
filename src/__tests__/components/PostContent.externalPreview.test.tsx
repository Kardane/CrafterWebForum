import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react";

vi.mock("@/components/ui/ImageLightboxProvider", () => {
	return {
		useImageLightbox: () => ({ openImage: vi.fn() }),
	};
});

class IntersectionObserverMock {
	private readonly elements = new Set<Element>();

	constructor(private readonly callback: IntersectionObserverCallback) {
		intersectionObserverInstances.push(this);
	}

	observe = vi.fn((element: Element) => {
		this.elements.add(element);
	});

	unobserve = vi.fn((element: Element) => {
		this.elements.delete(element);
	});

	disconnect = vi.fn(() => {
		this.elements.clear();
	});

	triggerVisible() {
		const entries = Array.from(this.elements).map(
			(element) =>
				({
					target: element,
					isIntersecting: true,
					intersectionRatio: 1,
				}) as IntersectionObserverEntry
		);
		this.callback(entries, this as unknown as IntersectionObserver);
	}
}

const intersectionObserverInstances: IntersectionObserverMock[] = [];

function installIntersectionObserverMock() {
	vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
}

async function flushVisibleCards() {
	await act(async () => {
		intersectionObserverInstances.forEach((observer) => observer.triggerVisible());
		await Promise.resolve();
	});
}

describe("PostContent external preview hydration", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		intersectionObserverInstances.splice(0, intersectionObserverInstances.length);
	});

	it("외부 카드가 없으면 preview fetch를 시작하지 않아야 함", async () => {
		installIntersectionObserverMock();
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);

		const { default: PostContent } = await import("@/components/posts/PostContent");
		render(<PostContent content={"그냥 본문만 있음"} />);

		await Promise.resolve();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("외부 카드는 observer 진입 전까지 preview fetch를 시작하지 않아야 함", async () => {
		installIntersectionObserverMock();
		const fetchMock = vi.fn(async () => {
			return new Response(
				JSON.stringify({
					preview: {
						badge: "GitHub",
						title: "visible-title",
						subtitle: "visible-subtitle",
						chips: ["chip-a"],
					},
				}),
				{ status: 200, headers: { "Content-Type": "application/json" } }
			);
		});
		vi.stubGlobal("fetch", fetchMock);

		const { default: PostContent } = await import("@/components/posts/PostContent");
		const view = render(<PostContent content={"[link](https://github.com/vercel/next.js/issues/10)"} />);

		expect(fetchMock).not.toHaveBeenCalled();

		await flushVisibleCards();

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(view.container.querySelector(".external-link-card__title")?.textContent).toBe("visible-title");
		});
	});

	it("dedupes /api/link-preview fetches across multiple instances", async () => {
		installIntersectionObserverMock();
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

		expect(fetchMock).not.toHaveBeenCalled();
		await flushVisibleCards();

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
			expect(view.container.querySelectorAll(".external-link-card__title")[0]?.textContent).toBe("enriched-title");
			expect(view.container.querySelectorAll(".external-link-card__title")[1]?.textContent).toBe("enriched-title");
		});
	});

	it("keeps existing meta chips when hydrated preview has no chips", async () => {
		installIntersectionObserverMock();
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

		await flushVisibleCards();

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
			const chips = view.container.querySelectorAll(".external-link-card__meta-chip");
			expect(chips.length).toBeGreaterThan(0);
			expect(chips[0]?.textContent).toContain("타입");
		});
	});

	it("falls back to icon thumbnail when preview image fails", async () => {
		installIntersectionObserverMock();
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

		await flushVisibleCards();

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledTimes(1);
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

	it("코드 블록이 없으면 highlight를 실행하지 않아야 함", async () => {
		installIntersectionObserverMock();
		const highlightElementMock = vi.fn();
		vi.stubGlobal("hljs", {
			highlightElement: highlightElementMock,
		});

		const { default: PostContent } = await import("@/components/posts/PostContent");
		render(<PostContent content={"일반 텍스트만 있음"} />);
		expect(highlightElementMock).not.toHaveBeenCalled();
	});
});
