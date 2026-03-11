/**
 * 마크다운 링크(<a>)를 임베드/카드로 업그레이드
 */

import { buildExternalCardByUrl } from "./external-card";
import { createImageEmbed, resolveImgurImageUrl } from "./media";
import {
	createStreamableEmbed,
	createYouTubeEmbed,
	extractStreamableIdFromUrl,
	extractYouTubeVideoIdFromUrl,
} from "./youtube";

function decodeHtmlEntities(value: string): string {
	return value
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#039;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">");
}

export function processAnchorEmbeds(html: string): string {
	return html.replace(/<a\b([^>]*)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi, (match, before, href, after) => {
		const attributes = `${before ?? ""} ${after ?? ""}`.toLowerCase();
		if (attributes.includes("file-download")) {
			return match;
		}

		const decodedHref = decodeHtmlEntities(href.trim());
		const youtubeId = extractYouTubeVideoIdFromUrl(decodedHref);
		if (youtubeId) {
			return createYouTubeEmbed(youtubeId);
		}

		const streamableId = extractStreamableIdFromUrl(decodedHref);
		if (streamableId) {
			return createStreamableEmbed(streamableId);
		}

		const imgurImageUrl = resolveImgurImageUrl(decodedHref);
		if (imgurImageUrl) {
			return createImageEmbed(imgurImageUrl, "imgur image");
		}

		const externalCard = buildExternalCardByUrl(decodedHref);
		if (externalCard.includes('class="external-link-card') || externalCard.includes("class='external-link-card")) {
			return externalCard;
		}

		return match;
	});
}
