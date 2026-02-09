/**
 * 본문에서 첫 번째 이미지 URL 추출
 * YouTube 링크나 갤러리 URL은 제외하고, 직접 업로드된 이미지나 Imgur 링크만 추출
 */
export function extractFirstImage(content: string): string | null {
	if (!content) return null;

	// 1. 직접 업로드된 이미지 또는 Imgur 직접 링크 (확장자 포함)
	const match = content.match(
		/(https?:\/\/i\.imgur\.com\/[a-zA-Z0-9]+\.(?:jpg|jpeg|png|gif|webp)|https?:\/\/[^\s)]+\/uploads\/[^\s)]+\.(?:jpg|jpeg|png|gif|webp)|\/uploads\/[^\s)]+\.(?:jpg|jpeg|png|gif|webp))/i
	);
	if (match) {
		return match[1];
	}

	// 2. Imgur 페이지 링크 (확장자 없는 경우 .png 붙여서 시도)
	// 단, gallery 경로는 제외
	const imgurMatch = content.match(/https?:\/\/imgur\.com\/([a-zA-Z0-9]+)(?![a-zA-Z0-9\.\/\-])/i);
	if (imgurMatch) {
		return `https://i.imgur.com/${imgurMatch[1]}.png`;
	}

	return null;
}

/**
 * 본문 미리보기 텍스트 생성 (마크다운 제거)
 */
export function getPreviewText(content: string, limit: number = 100): string {
	if (!content) return "";

	const text = content
		.replace(/```[\s\S]*?```/g, '') // 코드 블록
		.replace(
			/(https?:\/\/(?:i\.)?imgur\.com\/[^\s]+|https?:\/\/[^\s]+\/uploads\/[^\s]+|\/uploads\/[^\s]+)/gi,
			''
		) // 이미지 URL
		.replace(/https?:\/\/[^\s]+/gi, '') // 일반 URL
		.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 링크 텍스트
		.replace(/#{1,6}\s+/g, '') // 헤더
		.replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1') // 강조
		.replace(/~~([^~]+)~~/g, '$1') // 취소선
		.replace(/`([^`]+)`/g, '$1') // 인라인 코드
		.replace(/^>\s?/gm, '') // 인용
		.replace(/^[-*+]\s+/gm, '') // 리스트
		.replace(/^\d+\.\s+/gm, '') // 숫자 리스트
		.replace(/^[-*_]{3,}$/gm, '') // 수평선
		.replace(/\n+/g, ' ') // 줄바꿈 -> 공백
		.trim();

	return text.length > limit ? text.substring(0, limit) + "..." : text;
}
