import { describe, expect, it } from "vitest";
import { extractFirstImage, getPreviewText } from "@/lib/utils";

describe("content utils", () => {
	it("returns full blob upload url for first image", () => {
		const url = "https://x.public.blob.vercel-storage.com/uploads/2026/02/a.webp";
		const content = `![img](${url})`;
		expect(extractFirstImage(content)).toBe(url);
	});

	it("returns relative upload url when content uses local path", () => {
		const content = "본문 /uploads/2026/02/a.png";
		expect(extractFirstImage(content)).toBe("/uploads/2026/02/a.png");
	});

	it("removes blob upload urls from preview text", () => {
		const content =
			"설명 https://x.public.blob.vercel-storage.com/uploads/2026/02/a.webp 추가 텍스트";
		expect(getPreviewText(content)).toContain("설명");
		expect(getPreviewText(content)).toContain("추가 텍스트");
		expect(getPreviewText(content)).not.toContain("vercel-storage");
	});
});
