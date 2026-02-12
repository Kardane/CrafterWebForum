/**
 * @deprecated 이 파일은 `src/lib/embeds/index.ts`로 분할되었음
 * import 호환성 유지를 위한 barrel re-export
 * TODO: 이 파일 삭제 후 import 경로를 `@/lib/embeds`로 유지 가능 (embeds/ 디렉토리가 자동 해석됨)
 */
export {
	createYouTubeEmbed,
	createStreamableEmbed,
	processYouTubeEmbeds,
	escapeHtml,
	processExternalLinks,
	processUploadedFiles,
	processImageLinks,
	processAllEmbeds,
	type EmbedLink,
} from "./embeds/index";
