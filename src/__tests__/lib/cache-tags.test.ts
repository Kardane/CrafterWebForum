import { describe, expect, it } from "vitest";
import {
	buildPostDetailTag,
	buildPostListTag,
	getPostListCacheTags,
	getPostMutationTags,
	parsePostTags,
} from "@/lib/cache-tags";

describe("cache-tags", () => {
	it("parses post tags from json array", () => {
		expect(parsePostTags('["QnA","  공지  ","QnA"]')).toEqual(["QnA", "공지"]);
		expect(parsePostTags(null)).toEqual([]);
		expect(parsePostTags("invalid_json")).toEqual([]);
	});

	it("builds sanitized list tag", () => {
		expect(buildPostListTag("Tech News")).toBe("posts:list:tag:tech_news");
		expect(buildPostListTag("한글&기호")).toBe("posts:list:tag:_____");
	});

	it("builds list cache tags with base and optional tag", () => {
		expect(getPostListCacheTags(null)).toEqual(["posts:list"]);
		expect(getPostListCacheTags("notice")).toEqual(["posts:list", "posts:list:tag:notice"]);
	});

	it("builds mutation tags for list/detail/tag invalidation", () => {
		expect(buildPostDetailTag(42)).toBe("posts:detail:42");
		expect(
			getPostMutationTags({
				postId: 42,
				tags: ["notice", "dev log"],
			})
		).toEqual(
			expect.arrayContaining([
				"posts:list",
				"posts:detail:42",
				"posts:list:tag:notice",
				"posts:list:tag:dev_log",
			])
		);
	});
});

