/**
 * 외부 콘텐츠 임베드 처리 통합 진입점
 * YouTube, GitHub, Modrinth 등 외부 링크를 임베드 카드로 변환
 */

import { processYouTubeEmbeds } from "./youtube";
import { processExternalLinks } from "./external-card";
import { processUploadedFiles, processImageLinks } from "./media";
import { processAnchorEmbeds } from "./anchor";

// 하위 모듈 re-export
export { createYouTubeEmbed, createStreamableEmbed, processYouTubeEmbeds } from "./youtube";
export { escapeHtml, processExternalLinks, type EmbedLink } from "./external-card";
export { processUploadedFiles, processImageLinks } from "./media";

/**
 * HTML 내 이미 렌더링된 블록을 보호 → URL 정규식이 속성값을 다시 변환하지 않도록 방지
 */
interface ProtectedHtmlResult {
	protectedHtml: string;
	restoreHtml: (html: string) => string;
}

function protectRenderedHtml(html: string): ProtectedHtmlResult {
	const fragments: string[] = [];
	const protectedHtml = html.replace(
		/<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<a\b[\s\S]*?<\/a>|<img\b[^>]*>|<iframe[\s\S]*?<\/iframe>|<video[\s\S]*?<\/video>|<audio[\s\S]*?<\/audio>/gi,
		(fragment) => {
			fragments.push(fragment);
			return `__HTML_FRAGMENT_${fragments.length - 1}__`;
		}
	);

	return {
		protectedHtml,
		restoreHtml: (nextHtml: string) =>
			nextHtml.replace(/__HTML_FRAGMENT_(\d+)__/g, (_match, index) => {
				const parsedIndex = Number(index);
				return fragments[parsedIndex] ?? "";
			}),
	};
}

/**
 * 모든 임베드 처리를 통합 실행
 */
export function processAllEmbeds(html: string): string {
	const linkExpandedHtml = processAnchorEmbeds(html);
	const { protectedHtml, restoreHtml } = protectRenderedHtml(linkExpandedHtml);
	let nextHtml = protectedHtml;
	nextHtml = processYouTubeEmbeds(nextHtml);
	nextHtml = processExternalLinks(nextHtml);
	nextHtml = processUploadedFiles(nextHtml);
	nextHtml = processImageLinks(nextHtml);
	return restoreHtml(nextHtml);
}
