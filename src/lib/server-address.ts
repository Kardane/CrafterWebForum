export interface ParsedServerAddress {
	host: string;
	port: number;
	normalizedAddress: string;
}

const DOMAIN_PATTERN = /^(?=.{1,253}$)(?!-)(?:[a-zA-Z0-9-]{1,63}\.)*[a-zA-Z0-9-]{1,63}$/;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

function isValidIpv4(host: string): boolean {
	if (!IPV4_PATTERN.test(host)) {
		return false;
	}
	const parts = host.split(".").map((part) => Number(part));
	return parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
}

function isValidHost(host: string): boolean {
	if (host === "localhost" || host.endsWith(".local")) {
		return false;
	}
	if (isValidIpv4(host)) {
		return true;
	}
	return DOMAIN_PATTERN.test(host);
}

export function parseServerAddress(input: string): ParsedServerAddress | null {
	const raw = input.trim();
	if (!raw || raw.length > 255 || raw.includes("/")) {
		return null;
	}

	const match = raw.match(/^([^:\s]+)(?::(\d{1,5}))?$/);
	if (!match) {
		return null;
	}

	const host = match[1].trim().toLowerCase();
	const port = match[2] ? Number.parseInt(match[2], 10) : 25565;
	if (!isValidHost(host)) {
		return null;
	}
	if (!Number.isInteger(port) || port <= 0 || port > 65535) {
		return null;
	}

	return {
		host,
		port,
		normalizedAddress: match[2] ? `${host}:${port}` : host,
	};
}
