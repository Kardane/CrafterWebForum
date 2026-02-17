import { describe, expect, it } from "vitest";
import { escapeHtml, processMarkdown } from "@/lib/markdown";

describe("markdown utils", () => {
	it("escapes dangerous html chars", () => {
		expect(escapeHtml("<script>alert('x')</script>")).toContain("&lt;script&gt;");
	});

	it("renders markdown headers and bold", () => {
		const html = processMarkdown("# Title\n**Bold**");
		expect(html).toContain("<h1");
		expect(html).toContain("<strong>Bold</strong>");
	});

	it("renders image markdown as image tag", () => {
		const html = processMarkdown("![alt](https://example.com/a.png)");
		expect(html).toContain("<img src=\"https://example.com/a.png\"");
		expect(html).not.toContain("window.open");
	});

	it("removes redundant br around markdown images", () => {
		const html = processMarkdown("![alt](https://example.com/a.png)\n다음 줄 텍스트");
		expect(html).toContain("<img src=\"https://example.com/a.png\"");
		expect(html).toContain("다음 줄 텍스트");
		expect(html).not.toContain("md-image\" loading=\"lazy\" data-lightbox=\"image\"><br>");
	});

	it("limits code block preview to 20 lines with ellipsis", () => {
		const lines = Array.from({ length: 25 }, (_, index) => `line-${index + 1}`).join("\n");
		const html = processMarkdown(`\`\`\`ts\n${lines}\n\`\`\``);

		expect(html).toContain("line-1");
		expect(html).toContain("line-20");
		expect(html).not.toContain("line-21");
		expect(html).toContain("<br>...</code>");
	});

	it("normalizes extra line breaks between markdown blocks", () => {
		const html = processMarkdown("# Title\n- item");
		expect(html).toContain("<ul class=\"md-ul\">");
		expect(html).not.toContain("</h1><br><ul");
	});
});
