import { describe, expect, it } from "vitest";
import { appendBoundedSample, percentile } from "@/lib/perf-metrics";

describe("perf-metrics", () => {
	it("keeps only latest bounded samples", () => {
		expect(appendBoundedSample([1, 2], 3, 2)).toEqual([2, 3]);
	});

	it("ignores non-finite samples", () => {
		expect(appendBoundedSample([1, 2], Number.NaN, 5)).toEqual([1, 2]);
	});

	it("returns percentile value with nearest-rank", () => {
		expect(percentile([1, 10, 20, 30], 0.95)).toBe(30);
		expect(percentile([1, 10, 20, 30], 0.5)).toBe(10);
	});

	it("returns null for invalid percentile inputs", () => {
		expect(percentile([], 0.95)).toBeNull();
		expect(percentile([1, 2], 1.5)).toBeNull();
	});
});
