import { describe, expect, it } from "vitest";
import { createServerTimingHeader } from "@/lib/server-timing";

describe("createServerTimingHeader", () => {
	it("builds header with sanitized metric names and descriptions", () => {
		const header = createServerTimingHeader([
			{ name: "query_main", duration: 12.34 },
			{ name: "query main!", duration: 5, description: 'hello "world"' },
		]);

		expect(header).toContain("query_main;dur=12.3");
		expect(header).toContain("querymain;dur=5.0;desc=\"hello 'world'\"");
	});

	it("filters non-finite durations and empty metric token", () => {
		const header = createServerTimingHeader([
			{ name: "", duration: 1 },
			{ name: "nan", duration: Number.NaN },
			{ name: "ok", duration: 4 },
		]);

		expect(header).toBe("ok;dur=4.0");
	});

	it("normalizes negative durations to zero", () => {
		const header = createServerTimingHeader([{ name: "serialize", duration: -7 }]);

		expect(header).toBe("serialize;dur=0.0");
	});
});
