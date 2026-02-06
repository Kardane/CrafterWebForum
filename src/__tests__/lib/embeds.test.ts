import { describe, expect, it } from "vitest";
import { processAllEmbeds, processYouTubeEmbeds } from "@/lib/embeds";

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
});

