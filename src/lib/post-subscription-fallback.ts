import type { SidebarTrackedPost } from "@/types/sidebar";

const FALLBACK_STORAGE_KEY_PREFIX = "sidebarTrackedPostsFallback";

function sortFallbackTrackedPosts(rows: SidebarTrackedPost[]) {
	return [...rows].sort((a, b) => {
		const aTime = new Date(a.lastActivityAt).getTime();
		const bTime = new Date(b.lastActivityAt).getTime();
		if (aTime !== bTime) {
			return bTime - aTime;
		}
		return b.postId - a.postId;
	});
}

export function normalizeFallbackTrackedPosts(rows: SidebarTrackedPost[]) {
	return sortFallbackTrackedPosts(rows.filter((item) => item.isSubscribed && item.sourceFlags.subscribed));
}

export function buildPostSubscriptionFallbackStorageKey(userId: number) {
	return `${FALLBACK_STORAGE_KEY_PREFIX}:${userId}`;
}

export function readPostSubscriptionFallback(userId: number): SidebarTrackedPost[] {
	if (typeof window === "undefined" || !Number.isInteger(userId) || userId <= 0) {
		return [];
	}

	try {
		const raw = window.localStorage.getItem(buildPostSubscriptionFallbackStorageKey(userId));
		if (!raw) {
			return [];
		}

		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) {
			return [];
		}

		return normalizeFallbackTrackedPosts(
			parsed.filter((item): item is SidebarTrackedPost => {
				if (!item || typeof item !== "object") {
					return false;
				}
				const candidate = item as Partial<SidebarTrackedPost>;
				return (
					Number.isInteger(candidate.postId) &&
					typeof candidate.title === "string" &&
					typeof candidate.href === "string" &&
					typeof candidate.lastActivityAt === "string" &&
					typeof candidate.commentCount === "number" &&
					typeof candidate.newCommentCount === "number" &&
					typeof candidate.isSubscribed === "boolean" &&
					typeof candidate.author?.nickname === "string" &&
					typeof candidate.sourceFlags?.subscribed === "boolean" &&
					typeof candidate.sourceFlags?.authored === "boolean"
				);
			})
		);
	} catch (error) {
		console.error("[post-subscription-fallback] failed to read fallback list", error);
		return [];
	}
}

export function writePostSubscriptionFallback(userId: number, rows: SidebarTrackedPost[]) {
	if (typeof window === "undefined" || !Number.isInteger(userId) || userId <= 0) {
		return;
	}

	try {
		const storageKey = buildPostSubscriptionFallbackStorageKey(userId);
		const normalizedRows = normalizeFallbackTrackedPosts(rows);
		if (normalizedRows.length === 0) {
			window.localStorage.removeItem(storageKey);
			return;
		}
		window.localStorage.setItem(storageKey, JSON.stringify(normalizedRows));
	} catch (error) {
		console.error("[post-subscription-fallback] failed to write fallback list", error);
	}
}

export function hasPostSubscriptionFallback(userId: number, postId: number) {
	return readPostSubscriptionFallback(userId).some((item) => item.postId === postId);
}

export function upsertPostSubscriptionFallback(userId: number, item: SidebarTrackedPost) {
	const nextRows = normalizeFallbackTrackedPosts([
		...readPostSubscriptionFallback(userId).filter((row) => row.postId !== item.postId),
		item,
	]);
	writePostSubscriptionFallback(userId, nextRows);
	return nextRows;
}

export function removePostSubscriptionFallback(userId: number, postId: number) {
	const nextRows = normalizeFallbackTrackedPosts(
		readPostSubscriptionFallback(userId).filter((item) => item.postId !== postId)
	);
	writePostSubscriptionFallback(userId, nextRows);
	return nextRows;
}
