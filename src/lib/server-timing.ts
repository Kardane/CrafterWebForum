interface ServerTimingMetric {
	name: string;
	duration: number;
	description?: string;
}

function sanitizeMetricName(name: string) {
	return name.replace(/[^a-zA-Z0-9_-]/g, "");
}

function sanitizeDescription(description: string) {
	return description.replace(/"/g, "'");
}

export function createServerTimingHeader(metrics: ServerTimingMetric[]) {
	return metrics
		.filter((metric) => Number.isFinite(metric.duration))
		.map((metric) => {
			const token = sanitizeMetricName(metric.name);
			if (!token) {
				return null;
			}

			const normalizedDuration = Math.max(metric.duration, 0);
			const duration = normalizedDuration.toFixed(1);
			if (!metric.description) {
				return `${token};dur=${duration}`;
			}

			return `${token};dur=${duration};desc="${sanitizeDescription(metric.description)}"`;
		})
		.filter((metric): metric is string => metric !== null)
		.join(", ");
}
