export const MINECRAFT_AUTH_CODE_MIN_LENGTH = 6;
export const MINECRAFT_AUTH_CODE_MAX_LENGTH = 12;

// DB에는 대문자 정규화된 코드만 저장/조회하는 규칙
export const MINECRAFT_AUTH_CODE_REGEX = new RegExp(
	`^[0-9A-Z]{${MINECRAFT_AUTH_CODE_MIN_LENGTH},${MINECRAFT_AUTH_CODE_MAX_LENGTH}}$`
);

export const MINECRAFT_SIGNUP_CODE_LENGTH = 7;
export const MINECRAFT_REAUTH_CODE_LENGTH = 6;

const DEFAULT_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function normalizeMinecraftAuthCode(value: string): string {
	return value.trim().toUpperCase();
}

export function generateMinecraftAuthCode(
	length: number,
	{ alphabet = DEFAULT_ALPHABET }: { alphabet?: string } = {}
): string {
	if (!Number.isInteger(length) || length <= 0 || length > 64) {
		throw new Error("invalid_code_length");
	}
	if (alphabet.length < 2) {
		throw new Error("invalid_alphabet");
	}

	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);

	let out = "";
	for (let i = 0; i < bytes.length; i += 1) {
		out += alphabet[bytes[i] % alphabet.length];
	}
	return out;
}

