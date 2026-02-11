import texts from "@/messages/system.ko.json";

type TextValues = Record<string, string | number>;

function resolveTextByPath(path: string): string | null {
	const segments = path.split(".");
	let current: unknown = texts;
	for (const segment of segments) {
		if (typeof current !== "object" || current === null || !(segment in current)) {
			return null;
		}
		current = (current as Record<string, unknown>)[segment];
	}
	return typeof current === "string" ? current : null;
}

function interpolate(template: string, values?: TextValues): string {
	if (!values) {
		return template;
	}
	return template.replace(/\{(\w+)\}/g, (matched, key: string) => {
		const value = values[key];
		if (value === undefined) {
			return matched;
		}
		return String(value);
	});
}

export function text(path: string, values?: TextValues): string {
	const resolved = resolveTextByPath(path);
	if (!resolved) {
		return path;
	}
	return interpolate(resolved, values);
}

export function textOr(path: string, fallback: string, values?: TextValues): string {
	const resolved = resolveTextByPath(path);
	if (!resolved) {
		return fallback;
	}
	return interpolate(resolved, values);
}
