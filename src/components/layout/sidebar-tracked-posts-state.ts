import type { SidebarTrackedPost } from "@/types/sidebar";

export function sortTrackedPosts(rows: SidebarTrackedPost[]): SidebarTrackedPost[] {
	return [...rows].sort((a, b) => {
		const aTime = new Date(a.lastActivityAt).getTime();
		const bTime = new Date(b.lastActivityAt).getTime();
		if (aTime !== bTime) {
			return bTime - aTime;
		}
		return b.postId - a.postId;
	});
}

export function mergeTrackedPosts(existing: SidebarTrackedPost[], incoming: SidebarTrackedPost[]): SidebarTrackedPost[] {
	const map = new Map<number, SidebarTrackedPost>();
	for (const row of existing) {
		map.set(row.postId, row);
	}
	for (const row of incoming) {
		map.set(row.postId, row);
	}
	return sortTrackedPosts(Array.from(map.values()));
}

export function normalizeVisibleTrackedPosts(rows: SidebarTrackedPost[]): SidebarTrackedPost[] {
	return sortTrackedPosts(rows.filter((item) => item.isSubscribed && item.sourceFlags.subscribed));
}

export function mergeFallbackWithServerTrackedPosts(
	fallbackRows: SidebarTrackedPost[],
	serverRows: SidebarTrackedPost[]
): SidebarTrackedPost[] {
	return normalizeVisibleTrackedPosts(mergeTrackedPosts(fallbackRows, serverRows));
}

export function applyTrackedPostNotification(
	rows: SidebarTrackedPost[],
	input: { postId: number; commentId: number | null; occurredAt: string }
): SidebarTrackedPost[] {
	let changed = false;
	const updated = rows.map((item) => {
		if (item.postId !== input.postId) {
			return item;
		}
		changed = true;
		return {
			...item,
			commentCount: item.commentCount + 1,
			newCommentCount: item.newCommentCount + 1,
			latestCommentId: input.commentId ?? item.latestCommentId,
			lastActivityAt: input.occurredAt,
		};
	});
	return changed ? sortTrackedPosts(updated) : rows;
}

export function applyTrackedPostReadMarker(
	rows: SidebarTrackedPost[],
	input: { postId: number; totalCommentCount: number; lastReadCommentCount: number }
): SidebarTrackedPost[] {
	const unreadCount = Math.max(input.totalCommentCount - input.lastReadCommentCount, 0);
	return rows.map((item) => {
		if (item.postId !== input.postId) {
			return item;
		}
		return {
			...item,
			newCommentCount: unreadCount,
		};
	});
}
