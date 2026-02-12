/**
 * YouTube / Streamable 임베드 생성 및 HTML 내 링크 → iframe 변환
 */

/**
 * YouTube 임베드 HTML 생성
 */
export function createYouTubeEmbed(videoId: string): string {
	return `<div class="embed-container">
		<iframe 
			width="560" 
			height="315" 
			src="https://www.youtube.com/embed/${videoId}" 
			title="YouTube video player" 
			frameborder="0" 
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
			referrerpolicy="strict-origin-when-cross-origin" 
			allowfullscreen>
		</iframe>
	</div>`;
}

/**
 * Streamable 임베드 HTML 생성
 */
export function createStreamableEmbed(videoId: string): string {
	return `<div class="embed-container">
		<iframe 
			width="560" 
			height="315" 
			src="https://streamable.com/e/${videoId}" 
			frameborder="0" 
			allowfullscreen>
		</iframe>
	</div>`;
}

/**
 * 텍스트에서 YouTube/Streamable 링크를 추출하고 임베드로 변환
 */
export function processYouTubeEmbeds(html: string): string {
	const ytEmbeds: string[] = [];

	// youtube.com/watch?v=
	html = html.replace(
		/(?:https?:\/\/)(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:&[^\s]*)?/g,
		(_match, id) => {
			ytEmbeds.push(createYouTubeEmbed(id));
			return `__YT_EMBED_${ytEmbeds.length - 1}__`;
		}
	);

	// youtu.be/
	html = html.replace(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?[^\s]*)?/g, (_match, id) => {
		ytEmbeds.push(createYouTubeEmbed(id));
		return `__YT_EMBED_${ytEmbeds.length - 1}__`;
	});

	// Streamable
	html = html.replace(/https?:\/\/streamable\.com\/([a-z0-9]+)(?=$|[\s<])/gi, (_match, id) => {
		ytEmbeds.push(createStreamableEmbed(id));
		return `__YT_EMBED_${ytEmbeds.length - 1}__`;
	});

	// 복원
	html = html.replace(/__YT_EMBED_(\d+)__/g, (_match, index) => ytEmbeds[parseInt(index)]);

	return html;
}
