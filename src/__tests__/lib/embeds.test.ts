import { describe, expect, it } from "vitest";
import { processAllEmbeds, processYouTubeEmbeds } from "@/lib/embeds";
import { processMarkdown } from "@/lib/markdown";

describe("embed utils", () => {
	it("converts youtube urls into iframe embeds", () => {
		const html = processYouTubeEmbeds("https://youtu.be/dQw4w9WgXcQ");
		expect(html).toContain("youtube.com/embed/dQw4w9WgXcQ");
		expect(html).toContain("<iframe");
	});

	it("converts uploaded image links into image embed", () => {
		const html = processAllEmbeds("/uploads/2026/02/a.png");
		expect(html).toContain("<img src=\"/uploads/2026/02/a.png\"");
	});

	it("does not duplicate markdown images during embed pass", () => {
		const markdownHtml = processMarkdown("![alt](https://example.com/a.png)");
		const html = processAllEmbeds(markdownHtml);
		expect(html).toContain("<img src=\"https://example.com/a.png\" alt=\"alt\" class=\"md-image\"");
		expect(html).not.toContain("src=\"<div class=\"embed-container\"");
	});

	it("renders github links as cards", () => {
		const html = processAllEmbeds("https://github.com/vercel/next.js/issues/1");
		expect(html).toContain("external-link-card");
		expect(html).toContain("Issue #1");
	});
});
