/**
 * YouTube / Streamable 임베드 생성 및 HTML 내 링크 → iframe 변환
 */

function isValidYouTubeId(id: string | null): id is string {
	return typeof id === "string" && /^[a-zA-Z0-9_-]{11}$/.test(id);
}

export function extractYouTubeVideoIdFromUrl(rawUrl: string): string | null {
	try {
		const parsed = new URL(rawUrl);
		const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();

		if (hostname === "youtu.be") {
			const id = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
			return isValidYouTubeId(id) ? id : null;
		}

		if (hostname === "youtube.com" || hostname === "m.youtube.com") {
			const watchId = parsed.searchParams.get("v");
			if (isValidYouTubeId(watchId)) {
				return watchId;
			}
			const segments = parsed.pathname.split("/").filter(Boolean);
			const shortsId = segments[0] === "shorts" ? segments[1] ?? null : null;
			if (isValidYouTubeId(shortsId)) {
				return shortsId;
			}
		}
	} catch {
		return null;
	}
	return null;
}

export function extractStreamableIdFromUrl(rawUrl: string): string | null {
	try {
		const parsed = new URL(rawUrl);
		const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
		if (hostname !== "streamable.com") {
			return null;
		}
		const segments = parsed.pathname.split("/").filter(Boolean);
		if (segments.length === 0) {
			return null;
		}
		const id = segments[0] === "e" ? segments[1] ?? "" : segments[0];
		return /^[a-z0-9]+$/i.test(id) ? id : null;
	} catch {
		return null;
	}
}

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
