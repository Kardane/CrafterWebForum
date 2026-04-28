import { createHash, timingSafeEqual } from "node:crypto";
import { lookup, resolveSrv } from "node:dns/promises";
import { isIP } from "node:net";

export const MINECRAFT_VERIFY_SECRET_MIN_LENGTH = 32;

const placeholderSecrets = new Set([
	"replace-with-long-random-secret",
	"replace-with-minecraft-verify-secret",
	"test-secret-key-for-local-tests",
]);

export type MinecraftVerifyAuthResult =
	| { ok: true }
	| {
			ok: false;
			status: 401 | 503;
			error: "unauthorized" | "minecraft_verify_not_configured";
	  };

function digest(value: string) {
	return createHash("sha256").update(value).digest();
}

function splitAllowedSources(value: string) {
	return value
		.split(",")
		.map((entry) => entry.trim().toLowerCase())
		.filter(Boolean);
}

function normalizeIp(value: string) {
	const trimmed = value.trim().replace(/^\[|\]$/g, "");
	return isIP(trimmed) ? trimmed : "";
}

function parseIpList(value: string | null) {
	if (!value) {
		return [];
	}
	return value
		.split(",")
		.map(normalizeIp)
		.filter(Boolean);
}

function getRequestIp(request: Request) {
	return (
		normalizeIp(request.headers.get("x-real-ip") ?? "") ||
		parseIpList(request.headers.get("x-vercel-forwarded-for"))[0] ||
		parseIpList(request.headers.get("x-forwarded-for"))[0] ||
		""
	);
}

function isSafeHostname(value: string) {
	const normalized = value.endsWith(".") ? value.slice(0, -1) : value;
	if (!normalized || normalized.length > 253) {
		return false;
	}
	return normalized.split(".").every((label) =>
		label.length > 0 &&
		label.length <= 63 &&
		/^[a-z0-9-]+$/.test(label) &&
		!label.startsWith("-") &&
		!label.endsWith("-")
	);
}

export function getMinecraftVerifySecret() {
	return process.env.MINECRAFT_VERIFY_SECRET?.trim() ?? "";
}

export function getMinecraftVerifyAllowedSources() {
	return splitAllowedSources(process.env.MINECRAFT_VERIFY_ALLOWED_IPS ?? "");
}

export function isMinecraftVerifySecretConfigured(secret = getMinecraftVerifySecret()) {
	return (
		secret.length >= MINECRAFT_VERIFY_SECRET_MIN_LENGTH &&
		!placeholderSecrets.has(secret)
	);
}

async function resolveAllowedSourceIps(source: string) {
	if (isIP(source)) {
		return [source];
	}
	if (!isSafeHostname(source)) {
		return [];
	}

	const hostnames = new Set([source]);
	try {
		const srvRecords = await resolveSrv(`_minecraft._tcp.${source}`);
		for (const record of srvRecords) {
			if (isSafeHostname(record.name)) {
				hostnames.add(record.name.toLowerCase().replace(/\.$/, ""));
			}
		}
	} catch {
		// SRV 레코드가 없는 일반 호스트도 허용한다.
	}

	const ips = new Set<string>();
	for (const hostname of hostnames) {
		try {
			const addresses = await lookup(hostname, { all: true });
			for (const address of addresses) {
				ips.add(address.address);
			}
		} catch {
			// 해석되지 않는 항목은 무시한다.
		}
	}
	return [...ips];
}

async function isRequestFromAllowedSource(request: Request) {
	const requestIp = getRequestIp(request);
	if (!requestIp) {
		return false;
	}

	for (const source of getMinecraftVerifyAllowedSources()) {
		const allowedIps = await resolveAllowedSourceIps(source);
		if (allowedIps.includes(requestIp)) {
			return true;
		}
	}
	return false;
}

export async function authorizeMinecraftVerifyRequest(request: Request): Promise<MinecraftVerifyAuthResult> {
	const secret = getMinecraftVerifySecret();
	if (!isMinecraftVerifySecretConfigured(secret)) {
		return {
			ok: false,
			status: 503,
			error: "minecraft_verify_not_configured",
		};
	}

	const authorization = request.headers.get("authorization") ?? "";
	const expectedAuthorization = `Bearer ${secret}`;

	if (authorization) {
		if (timingSafeEqual(digest(authorization), digest(expectedAuthorization))) {
			return { ok: true };
		}
		return {
			ok: false,
			status: 401,
			error: "unauthorized",
		};
	}

	if (await isRequestFromAllowedSource(request)) {
		return { ok: true };
	}

	return {
		ok: false,
		status: 401,
		error: "unauthorized",
	};
}
