/**
 * 외부 콘텐츠 임베드 처리 유틸리티
 * YouTube, GitHub, Modrinth 등 외부 링크를 임베드 카드로 변환
 */

export interface EmbedLink {
	url: string;
	type: 'youtube' | 'streamable' | 'github' | 'gitlab' | 'modrinth' | 'curseforge' | 'spigot' | 'other';
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
 * 텍스트에서 YouTube 링크를 추출하고 임베드로 변환
 */
export function processYouTubeEmbeds(html: string): string {
	const ytEmbeds: string[] = [];

	// youtube.com/watch?v=
	html = html.replace(
		/(?:https?:\/\/)(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:&[^\s]*)?/g,
		(match, id) => {
			ytEmbeds.push(createYouTubeEmbed(id));
			return `__YT_EMBED_${ytEmbeds.length - 1}__`;
		}
	);

	// youtu.be/
	html = html.replace(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?[^\s]*)?/g, (match, id) => {
		ytEmbeds.push(createYouTubeEmbed(id));
		return `__YT_EMBED_${ytEmbeds.length - 1}__`;
	});

	// Streamable
	html = html.replace(/https?:\/\/streamable\.com\/([a-z0-9]+)(?=$|[\s<])/gi, (match, id) => {
		ytEmbeds.push(createStreamableEmbed(id));
		return `__YT_EMBED_${ytEmbeds.length - 1}__`;
	});

	// 복원
	html = html.replace(/__YT_EMBED_(\d+)__/g, (match, index) => ytEmbeds[parseInt(index)]);

	return html;
}

/**
 * GitHub/GitLab/Modrinth 등 외부 링크를 플레이스홀더로 변환
 * (실제 카드 렌더링은 클라이언트에서 처리)
 */
export function processExternalLinks(html: string): string {
	const ghLinks: Array<{ url: string }> = [];

	// GitHub, GitLab, Codeberg, Modrinth
	html = html.replace(
		/https?:\/\/(?:www\.)?(github\.com|gitlab\.com|codeberg\.org|modrinth\.com)\/([a-zA-Z0-9\-_.]+)(?:\/([^\s<"']+))?(?=$|[\s<])/gi,
		(match) => {
			const cleanUrl = match.trim().replace(/[.,]$/, '');
			ghLinks.push({ url: cleanUrl });
			return `__GH_LINK_${ghLinks.length - 1}__`;
		}
	);

	// CurseForge
	html = html.replace(
		/https?:\/\/(?:www\.)?curseforge\.com\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)\/([a-zA-Z0-9\-_.]+)(?=$|[\s<])/gi,
		(match, game, category, slug) => {
			const cleanUrl = `https://www.curseforge.com/${game}/${category}/${slug}`;
			ghLinks.push({ url: cleanUrl });
			return `__GH_LINK_${ghLinks.length - 1}__`;
		}
	);

	// Spigot
	html = html.replace(
		/https?:\/\/(?:www\.)?spigotmc\.org\/resources\/([^\/]+\.[0-9]+)\/?(?=$|[\s<])/gi,
		(match) => {
			ghLinks.push({ url: match.trim() });
			return `__GH_LINK_${ghLinks.length - 1}__`;
		}
	);

	// 복원 (플레이스홀더 + 폴백 링크)
	html = html.replace(/__GH_LINK_(\d+)__/g, (match, index) => {
		const link = ghLinks[parseInt(index)];
		return `<div class="github-embed-placeholder" data-url="${link.url}" style="display:none;"></div><a href="${link.url}" target="_blank" class="link-text github-fallback">${link.url}</a>`;
	});

	return html;
}

/**
 * 업로드된 파일 링크 처리 (이미지, 비디오, 오디오)
 */
export function processUploadedFiles(html: string): string {
	html = html.replace(/((?:https?:\/\/[^\s]+)?\/uploads\/([^\s"']+))/gi, (match, fullUrl, filename) => {
		if (
			match.includes('__MD_LINK_') ||
			match.includes('__GH_LINK_') ||
			match.includes('\x1FCODE')
		)
			return match;

		const ext = filename.split('.').pop()?.toLowerCase().split('?')[0] || '';

		if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
			return `<div class="embed-container"><img src="${fullUrl}" alt="uploaded image"></div>`;
		}
		if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
			return `<div class="embed-container"><video src="${fullUrl}" controls></video></div>`;
		}
		if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
			return `<div class="embed-container"><audio src="${fullUrl}" controls></audio></div>`;
		}
		return `<a href="${fullUrl}" download class="file-download">📦 ${filename}</a>`;
	});

	return html;
}

/**
 * 일반 이미지 링크 자동 임베드
 */
export function processImageLinks(html: string): string {
	html = html.replace(/(https?:\/\/[^\s<"']+)/gi, (match) => {
		if (
			match.includes('embed-container') ||
			match.includes('iframe') ||
			match.includes('<img') ||
			match.includes('<video') ||
			match.includes('<audio') ||
			match.includes('file-download') ||
			match.includes('/uploads/') ||
			match.includes('__MD_LINK_') ||
			match.includes('__GH_LINK_') ||
			match.includes('\x1FCODE') ||
			match.includes('__YT_EMBED_')
		)
			return match;

		if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(match)) {
			return `<div class="embed-container"><img src="${match}" alt="image" loading="lazy"></div>`;
		}
		return `<a href="${match}" target="_blank" class="link-text">${match}</a>`;
	});

	return html;
}

/**
 * 모든 임베드 처리를 통합 실행
 */
export function processAllEmbeds(html: string): string {
	html = processYouTubeEmbeds(html);
	html = processExternalLinks(html);
	html = processUploadedFiles(html);
	html = processImageLinks(html);
	return html;
}
