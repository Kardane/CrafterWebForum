export function appendBoundedSample(samples: number[], sample: number, maxSamples: number): number[] {
	if (!Number.isFinite(sample) || maxSamples <= 0) {
		return samples;
	}

	const next = [...samples, sample];
	if (next.length <= maxSamples) {
		return next;
	}
	return next.slice(next.length - maxSamples);
}

export function percentile(samples: number[], ratio: number): number | null {
	if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1 || samples.length === 0) {
		return null;
	}

	const sorted = [...samples].sort((a, b) => a - b);
	const index = Math.ceil(ratio * sorted.length) - 1;
	const normalizedIndex = Math.min(sorted.length - 1, Math.max(0, index));
	return sorted[normalizedIndex] ?? null;
}
