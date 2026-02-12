/**
 * 업로드 파일 및 이미지 링크 임베드 처리
 */

export function createImageEmbed(imageUrl: string, alt = "image"): string {
	return `<div class="embed-container"><img src="${imageUrl}" alt="${alt}" loading="lazy"></div>`;
}

export function resolveImgurImageUrl(rawUrl: string): string | null {
	try {
		const parsed = new URL(rawUrl);
		const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
		const pathSegments = parsed.pathname.split("/").filter(Boolean);
		if (pathSegments.length === 0) {
			return null;
		}

		if (hostname === "i.imgur.com") {
			const filename = pathSegments[pathSegments.length - 1];
			if (/\.(?:jpg|jpeg|png|gif|webp|mp4)$/i.test(filename)) {
				return `${parsed.origin}${parsed.pathname}${parsed.search}`;
			}
			return null;
		}

		if (hostname === "imgur.com") {
			let candidateId = pathSegments[0];
			if ((pathSegments[0] === "gallery" || pathSegments[0] === "a") && pathSegments[1]) {
				candidateId = pathSegments[1];
			}
			if (!/^[a-zA-Z0-9]{5,}$/.test(candidateId)) {
				return null;
			}
			return `https://i.imgur.com/${candidateId}.png`;
		}
	} catch {
		return null;
	}
	return null;
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
			return createImageEmbed(fullUrl, "uploaded image");
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
			return `${prefix}${createImageEmbed(url)}`;
		}

		const imgurImageUrl = resolveImgurImageUrl(url);
		if (imgurImageUrl) {
			return `${prefix}${createImageEmbed(imgurImageUrl, "imgur image")}`;
		}
		return `${prefix}<a href="${url}" target="_blank" class="link-text">${url}</a>`;
	});

	return html;
}
