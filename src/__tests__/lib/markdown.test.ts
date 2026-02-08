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
});
