import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_IPV4_RANGES = [
	{ start: [0, 0, 0, 0], end: [0, 255, 255, 255] },
	{ start: [10, 0, 0, 0], end: [10, 255, 255, 255] },
	{ start: [100, 64, 0, 0], end: [100, 127, 255, 255] },
	{ start: [127, 0, 0, 0], end: [127, 255, 255, 255] },
	{ start: [169, 254, 0, 0], end: [169, 254, 255, 255] },
	{ start: [172, 16, 0, 0], end: [172, 31, 255, 255] },
	{ start: [192, 0, 0, 0], end: [192, 0, 0, 255] },
	{ start: [192, 168, 0, 0], end: [192, 168, 255, 255] },
	{ start: [198, 18, 0, 0], end: [198, 19, 255, 255] },
	{ start: [224, 0, 0, 0], end: [255, 255, 255, 255] },
];

function toIpv4Octets(ip: string): number[] | null {
	const parts = ip.split(".").map((part) => Number.parseInt(part, 10));
	if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
		return null;
	}
	return parts;
}

function isIpv4InRange(ipv4: string, start: number[], end: number[]): boolean {
	const octets = toIpv4Octets(ipv4);
	if (!octets) {
		return false;
	}
	for (let index = 0; index < 4; index += 1) {
		if (octets[index] < start[index]) {
			return false;
		}
		if (octets[index] > end[index]) {
			return false;
		}
	}
	return true;
}

function normalizeIpv6(value: string): string {
	return value.trim().replace(/^\[|\]$/g, "").toLowerCase();
}

function isBlockedIpv6(ipv6: string): boolean {
	const normalized = normalizeIpv6(ipv6);
	if (!normalized) {
		return true;
	}
	if (normalized === "::" || normalized === "::1") {
		return true;
	}
	if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
		return true;
	}
	if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
		return true;
	}
	if (normalized.startsWith("ff")) {
		return true;
	}
	if (normalized.startsWith("::ffff:")) {
		const mappedIpv4 = normalized.slice("::ffff:".length);
		return isBlockedIpAddress(mappedIpv4);
	}
	return false;
}

export function isBlockedHostname(hostname: string): boolean {
	const normalized = hostname.trim().replace(/^\[|\]$/g, "").toLowerCase();
	if (!normalized) {
		return true;
	}
	if (normalized === "localhost" || normalized.endsWith(".local")) {
		return true;
	}
	return false;
}

export function isBlockedIpAddress(ipAddress: string): boolean {
	const normalized = ipAddress.trim().replace(/^\[|\]$/g, "");
	if (!normalized) {
		return true;
	}
	const family = isIP(normalized);
	if (family === 4) {
		return BLOCKED_IPV4_RANGES.some((range) => isIpv4InRange(normalized, range.start, range.end));
	}
	if (family === 6) {
		return isBlockedIpv6(normalized);
	}
	return true;
}

export async function resolvePublicIps(hostname: string): Promise<string[]> {
	if (isBlockedHostname(hostname)) {
		throw new Error("blocked_hostname");
	}

	const normalized = hostname.trim().replace(/^\[|\]$/g, "");
	if (isIP(normalized)) {
		if (isBlockedIpAddress(normalized)) {
			throw new Error("blocked_ip");
		}
		return [normalized];
	}

	const resolved = await lookup(normalized, { all: true, verbatim: true });
	if (resolved.length === 0) {
		throw new Error("host_resolution_failed");
	}

	const uniqueAddresses = Array.from(new Set(resolved.map((entry) => entry.address)));
	if (uniqueAddresses.some((address) => isBlockedIpAddress(address))) {
		throw new Error("blocked_ip");
	}
	return uniqueAddresses;
}

export async function assertSafeHttpUrl(parsedUrl: URL): Promise<void> {
	if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
		throw new Error("invalid_protocol");
	}
	await resolvePublicIps(parsedUrl.hostname);
}
