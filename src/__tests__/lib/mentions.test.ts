import { describe, expect, it } from "vitest";
import { extractMentionNicknames } from "@/lib/mentions";

describe("extractMentionNicknames", () => {
	it("본문에서 멘션 닉네임을 중복 없이 추출", () => {
		expect(extractMentionNicknames("안녕 @steve @alex @steve")).toEqual(["steve", "alex"]);
	});

	it("문장부호를 제외하고 멘션을 추출", () => {
		expect(extractMentionNicknames("@karn, 확인해줘! @개발자님.")).toEqual(["karn", "개발자님"]);
	});
});
