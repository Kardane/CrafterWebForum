const DEFAULT_SUNSET_DATE = "Thu, 30 Apr 2026 23:59:59 GMT";

export function getDeprecationHeaders(successorPath: string): Record<string, string> {
	return {
		Deprecation: "true",
		Sunset: DEFAULT_SUNSET_DATE,
		Link: `<${successorPath}>; rel="successor-version"`,
	};
}
