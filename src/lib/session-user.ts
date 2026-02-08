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
