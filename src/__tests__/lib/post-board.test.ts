import { describe, expect, it } from "vitest";

describe("post-board metadata", () => {
	it("defaults missing board metadata to develope", async () => {
		const { parsePostTagMetadata } = await import("@/lib/post-board");

		expect(parsePostTagMetadata(null)).toEqual({
			board: "develope",
			serverAddress: null,
			tags: [],
		});
	});

	it("uses explicit board and serverAddress fields when present", async () => {
		const { parsePostTagMetadata } = await import("@/lib/post-board");

		expect(parsePostTagMetadata('["질문"]', "sinmungo", "mc.example.com:25565")).toEqual({
			board: "sinmungo",
			serverAddress: "mc.example.com:25565",
			tags: ["질문"],
		});
	});

	it("falls back to legacy ombudsman tag metadata when board field is absent", async () => {
		const { parsePostTagMetadata, OMBUDSMAN_BOARD_MARKER } = await import("@/lib/post-board");

		expect(
			parsePostTagMetadata(
				JSON.stringify([OMBUDSMAN_BOARD_MARKER, "__sys:server:mc.legacy.kr", "기타"])
			)
		).toEqual({
			board: "sinmungo",
			serverAddress: "mc.legacy.kr",
			tags: ["기타"],
		});
	});

	it("normalizes unsupported board values to develope", async () => {
		const { normalizeBoardType } = await import("@/lib/post-board");

		expect(normalizeBoardType("forum")).toBe("develope");
		expect(normalizeBoardType("sinmungo")).toBe("sinmungo");
		expect(normalizeBoardType(undefined)).toBe("develope");
	});
});
