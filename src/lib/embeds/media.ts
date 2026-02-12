/**
 * 업로드 파일 및 이미지 링크 임베드 처리
 */

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
	html = html.replace(/(^|[\s>()])(https?:\/\/[^\s<"']+)/gi, (match, prefix, url) => {
		if (
			url.includes('embed-container') ||
			url.includes('iframe') ||
			url.includes('<img') ||
			url.includes('<video') ||
			url.includes('<audio') ||
			url.includes('file-download') ||
			url.includes('/uploads/') ||
			url.includes('__MD_LINK_') ||
			url.includes('__GH_LINK_') ||
			url.includes('\x1FCODE') ||
			url.includes('__YT_EMBED_')
		)
			return `${prefix}${url}`;

		if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) {
			return `${prefix}<div class="embed-container"><img src="${url}" alt="image" loading="lazy"></div>`;
		}
		return `${prefix}<a href="${url}" target="_blank" class="link-text">${url}</a>`;
	});

	return html;
}
