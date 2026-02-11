const UUID_DASHED_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_COMPACT_PATTERN = /^[0-9a-f]{32}$/i;

function toDashedUuid(compactUuid: string): string {
	return [
		compactUuid.slice(0, 8),
		compactUuid.slice(8, 12),
		compactUuid.slice(12, 16),
		compactUuid.slice(16, 20),
		compactUuid.slice(20),
	].join("-");
}

export function normalizeMinecraftUuid(uuid: string | null | undefined): string | null {
	if (!uuid) {
		return null;
	}

	const normalized = uuid.trim().toLowerCase();
	if (UUID_DASHED_PATTERN.test(normalized)) {
		return normalized;
	}
	if (UUID_COMPACT_PATTERN.test(normalized)) {
		return toDashedUuid(normalized);
	}
	return null;
}

export function buildAvatarCandidates(uuid: string | null | undefined, size: number): string[] {
	const normalizedUuid = normalizeMinecraftUuid(uuid);
	if (!normalizedUuid) {
		return [];
	}

	const normalizedSize = Math.max(16, Math.floor(size));
	const scale = Math.max(1, Math.round(normalizedSize / 8));

	// 외부 스킨 서비스 장애 대비 폴백 순서 유지
	return [
		`https://api.mineatar.io/face/${normalizedUuid}?scale=${scale}`,
		`https://mc-heads.net/avatar/${normalizedUuid}/${normalizedSize}`,
	];
}
