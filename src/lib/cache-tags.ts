import { revalidateTag } from "next/cache";
import { isReservedPostTag } from "@/lib/post-board";

const POSTS_LIST_BASE_TAG = "posts:list";
const POSTS_LIST_TAG_PREFIX = "posts:list:tag:";
const POSTS_DETAIL_TAG_PREFIX = "posts:detail:";

function sanitizeCacheTagToken(value: string) {
	const normalized = value.trim().toLowerCase();
	return normalized.replace(/[^a-z0-9_-]/g, "_").slice(0, 64);
}

function normalizeTags(tags: string[]) {
	const unique = new Set<string>();
	for (const tag of tags) {
		if (typeof tag !== "string") {
			continue;
		}
		const trimmed = tag.trim();
		if (!trimmed) {
			continue;
		}
		unique.add(trimmed);
	}
	return Array.from(unique);
}

export function parsePostTags(rawTags: string | null): string[] {
	if (!rawTags) {
		return [];
	}
	try {
		const parsed = JSON.parse(rawTags) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return normalizeTags(
			parsed.filter((tag): tag is string => typeof tag === "string" && !isReservedPostTag(tag))
		);
	} catch {
		return [];
	}
}

export function buildPostListTag(tag: string) {
	return `${POSTS_LIST_TAG_PREFIX}${sanitizeCacheTagToken(tag)}`;
}

export function buildPostDetailTag(postId: number) {
	return `${POSTS_DETAIL_TAG_PREFIX}${postId}`;
}

export function getPostListCacheTags(tag: string | null | undefined) {
	const tags = [POSTS_LIST_BASE_TAG];
	if (tag && tag.trim()) {
		tags.push(buildPostListTag(tag));
	}
	return tags;
}

export function getPostMutationTags(input: {
	postId?: number;
	tags?: string[];
	rawTags?: string | null;
}) {
	const normalizedTags =
		input.tags && input.tags.length > 0 ? normalizeTags(input.tags) : parsePostTags(input.rawTags ?? null);
	const cacheTags = new Set<string>([POSTS_LIST_BASE_TAG]);

	if (typeof input.postId === "number" && Number.isInteger(input.postId) && input.postId > 0) {
		cacheTags.add(buildPostDetailTag(input.postId));
	}

	for (const tag of normalizedTags) {
		cacheTags.add(buildPostListTag(tag));
	}

	return Array.from(cacheTags);
}

export function safeRevalidateTags(tags: string[]) {
	for (const tag of new Set(tags)) {
		try {
			revalidateTag(tag, "max");
		} catch (error) {
			if (process.env.NODE_ENV !== "test") {
				console.warn(`[cache] revalidateTag failed: ${tag}`, error);
			}
		}
	}
}
