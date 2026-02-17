/**
 * 세션 사용자 ID를 안전한 양의 정수로 정규화
 */
export function toSessionUserId(rawUserId: unknown): number | null {
	const parsed = Number(rawUserId);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return null;
	}
	return parsed;
}

export function isSessionUserApproved(rawIsApproved: unknown): boolean {
	if (rawIsApproved === 0 || rawIsApproved === "0") {
		return false;
	}
	return true;
}
