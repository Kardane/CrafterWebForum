import { describe, expect, it } from "vitest";
import { processAllEmbeds, processYouTubeEmbeds, escapeHtml, createStreamableEmbed } from "@/lib/embeds";
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

	it("converts uploaded video links into video embed", () => {
		const html = processAllEmbeds("/uploads/2026/02/a.mp4");
		expect(html).toContain("<video src=\"/uploads/2026/02/a.mp4\" controls></video>");
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
		expect(html).toContain("external-link-card__icon");
		expect(html).toContain("Issue #1");
	});

	it("renders minecraft wiki links as cards with icon", () => {
		const html = processAllEmbeds("https://minecraft.wiki/w/Redstone");
		expect(html).toContain("external-link-card");
		expect(html).toContain("minecraft.wiki");
		expect(html).toContain("external-link-card__icon");
	});

	it("converts youtube.com/watch format into iframe", () => {
		const html = processYouTubeEmbeds("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
		expect(html).toContain("youtube.com/embed/dQw4w9WgXcQ");
	});

	it("converts streamable links into iframe embeds", () => {
		const embed = createStreamableEmbed("abc123");
		expect(embed).toContain("streamable.com/e/abc123");
		expect(embed).toContain("<iframe");
	});

	it("converts markdown youtube links into iframe embeds", () => {
		const markdownHtml = processMarkdown("[영상](https://youtu.be/dQw4w9WgXcQ)");
		const html = processAllEmbeds(markdownHtml);
		expect(html).toContain("youtube.com/embed/dQw4w9WgXcQ");
		expect(html).toContain("<iframe");
	});

	it("converts imgur page links into image embeds", () => {
		const html = processAllEmbeds("https://imgur.com/abcDEF1");
		expect(html).toContain("<img src=\"https://i.imgur.com/abcDEF1.png\"");
	});

	it("escapeHtml escapes special characters", () => {
		expect(escapeHtml('<script>alert("xss")</script>')).toBe(
			"&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
		);
		expect(escapeHtml("a & b")).toBe("a &amp; b");
		expect(escapeHtml("it's")).toBe("it&#039;s");
	});

	it("protects pre/code/img tags from being re-processed", () => {
		const preBlock = '<pre><code>https://youtu.be/dQw4w9WgXcQ</code></pre>';
		const result = processAllEmbeds(preBlock);
		// pre/code 내부의 URL은 iframe으로 변환되면 안 됨
		expect(result).toContain("<pre><code>");
		expect(result).not.toContain("embed-container");
	});
});
