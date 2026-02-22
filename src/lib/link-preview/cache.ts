import type { LinkPreview } from "@/lib/link-preview/types";

const LINK_PREVIEW_CACHE_TTL_MS = 60 * 5 * 1_000;
const LINK_PREVIEW_CACHE_MAX_ENTRIES = 500;

type LinkPreviewCacheItem = {
	preview: LinkPreview;
	expiresAt: number;
};

const linkPreviewCache = new Map<string, LinkPreviewCacheItem>();

export function getCachedLinkPreview(url: string): LinkPreview | null {
	const cached = linkPreviewCache.get(url);
	if (!cached) {
		return null;
	}
	if (cached.expiresAt <= Date.now()) {
		linkPreviewCache.delete(url);
		return null;
	}
	return cached.preview;
}

export function setCachedLinkPreview(url: string, preview: LinkPreview) {
	if (linkPreviewCache.has(url)) {
		linkPreviewCache.delete(url);
	}
	linkPreviewCache.set(url, {
		preview,
		expiresAt: Date.now() + LINK_PREVIEW_CACHE_TTL_MS,
	});
	if (linkPreviewCache.size > LINK_PREVIEW_CACHE_MAX_ENTRIES) {
		const oldestKey = linkPreviewCache.keys().next().value;
		if (oldestKey) {
			linkPreviewCache.delete(oldestKey);
		}
	}
}
