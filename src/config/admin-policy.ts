const DEFAULT_ADMIN_NICKNAMES = ["Karned"];

function normalizeNickname(nickname: string): string {
	return nickname.trim().toLowerCase();
}

function parseAdminNicknames(envValue: string | undefined): string[] {
	if (!envValue) {
		return [];
	}

	return envValue
		.split(",")
		.map(normalizeNickname)
		.filter((nickname) => nickname.length > 0);
}

const configuredNicknames = parseAdminNicknames(process.env.ADMIN_NICKNAMES);
const adminNicknameSet = new Set(
	[...DEFAULT_ADMIN_NICKNAMES.map(normalizeNickname), ...configuredNicknames]
);

export function isPrivilegedNickname(nickname: string | null | undefined): boolean {
	if (!nickname) {
		return false;
	}

	return adminNicknameSet.has(normalizeNickname(nickname));
}

