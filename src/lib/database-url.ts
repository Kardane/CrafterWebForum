const TURSO_PROTOCOL_PREFIXES = ["libsql://", "turso://"];

export function isSqliteFileDatabaseUrl(databaseUrl: string) {
	return databaseUrl.toLowerCase().startsWith("file:");
}

export function isTursoDatabaseUrl(databaseUrl: string) {
	const normalized = databaseUrl.toLowerCase();
	return TURSO_PROTOCOL_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
