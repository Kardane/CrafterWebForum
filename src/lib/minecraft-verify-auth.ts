import { createHash, timingSafeEqual } from "node:crypto";

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

export function getMinecraftVerifySecret() {
	return process.env.MINECRAFT_VERIFY_SECRET?.trim() ?? "";
}

export function isMinecraftVerifySecretConfigured(secret = getMinecraftVerifySecret()) {
	return (
		secret.length >= MINECRAFT_VERIFY_SECRET_MIN_LENGTH &&
		!placeholderSecrets.has(secret)
	);
}

export function authorizeMinecraftVerifyRequest(request: Request): MinecraftVerifyAuthResult {
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

	if (!timingSafeEqual(digest(authorization), digest(expectedAuthorization))) {
		return {
			ok: false,
			status: 401,
			error: "unauthorized",
		};
	}

	return { ok: true };
}
