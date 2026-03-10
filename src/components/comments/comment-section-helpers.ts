import { flattenCommentsForStream } from "@/lib/comment-stream";
import {
	type Comment,
	LATEST_CHUNK_SIZE,
	THREAD_COLLAPSE_THRESHOLD,
	getReadMarkerIndex,
} from "@/lib/comment-tree-ops";

interface InitialCommentViewState {
	visibleStart: number;
	expandedThreadRoots: Set<number>;
}

interface ShouldRefreshCommentsOnMountInput {
	initialComments: Comment[];
	lastReadCommentCount: number;
	totalCommentCount: number;
	targetCommentId: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function toDateKey(value: string): string {
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) {
		return "invalid";
	}
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function toDateLabel(value: string): string {
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) {
		return "날짜 알 수 없음";
	}
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const w = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];

	return `${y}년 ${m}월 ${d}일 (${w})`;
}

export function hasCommentId(nodes: Comment[], commentId: number): boolean {
	for (const node of nodes) {
		if (node.id === commentId) {
			return true;
		}
		if (node.replies.length > 0 && hasCommentId(node.replies, commentId)) {
			return true;
		}
	}
	return false;
}

export function parseRealtimeComment(payload: Record<string, unknown>): Comment | null {
	const rawComment = payload.comment;
	if (!isRecord(rawComment)) {
		return null;
	}
	const rawAuthor = rawComment.author;
	if (!isRecord(rawAuthor)) {
		return null;
	}

	const id = Number(rawComment.id);
	const content = typeof rawComment.content === "string" ? rawComment.content : "";
	const createdAt = typeof rawComment.createdAt === "string" ? rawComment.createdAt : "";
	const updatedAt = typeof rawComment.updatedAt === "string" ? rawComment.updatedAt : "";
	const parentIdRaw = rawComment.parentId;
	const parentId = parentIdRaw === null ? null : Number(parentIdRaw);
	const authorId = Number(rawAuthor.id);
	const authorNickname = typeof rawAuthor.nickname === "string" ? rawAuthor.nickname : "";
	const authorRole = typeof rawAuthor.role === "string" ? rawAuthor.role : "user";
	const authorUuid = rawAuthor.minecraftUuid;

	if (!Number.isInteger(id) || id <= 0) {
		return null;
	}
	if (!content || !createdAt || !updatedAt) {
		return null;
	}
	if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) {
		return null;
	}
	if (!Number.isInteger(authorId) || authorId <= 0 || !authorNickname) {
		return null;
	}

	return {
		id,
		content,
		createdAt,
		updatedAt,
		isPinned: Boolean(rawComment.isPinned),
		parentId,
		isPostAuthor: Boolean(rawComment.isPostAuthor),
		author: {
			id: authorId,
			nickname: authorNickname,
			minecraftUuid: typeof authorUuid === "string" ? authorUuid : null,
			role: authorRole,
		},
		replies: [],
	};
}

export function buildInitialCommentViewState(
	initialComments: Comment[],
	lastReadCommentCount: number
): InitialCommentViewState {
	const flattened = flattenCommentsForStream(initialComments);
	const total = flattened.length;
	if (total === 0) {
		return { visibleStart: 0, expandedThreadRoots: new Set<number>() };
	}

	const readMarkerIndex = getReadMarkerIndex(total, lastReadCommentCount);
	const defaultStart = Math.max(0, total - LATEST_CHUNK_SIZE);
	const visibleStart = readMarkerIndex !== null && readMarkerIndex < defaultStart ? readMarkerIndex : defaultStart;
	const expandedThreadRoots = new Set<number>();

	if (readMarkerIndex === null) {
		return { visibleStart, expandedThreadRoots };
	}

	const markerItem = flattened[readMarkerIndex];
	if (markerItem?.comment.parentId === null) {
		return { visibleStart, expandedThreadRoots };
	}

	let replyCount = 0;
	for (const item of flattened) {
		if (item.threadRootId === markerItem.threadRootId && item.comment.parentId !== null) {
			replyCount += 1;
		}
	}
	if (replyCount >= THREAD_COLLAPSE_THRESHOLD) {
		expandedThreadRoots.add(markerItem.threadRootId);
	}

	return { visibleStart, expandedThreadRoots };
}

export function shouldRefreshCommentsOnMount({
	initialComments,
	lastReadCommentCount,
	totalCommentCount,
	targetCommentId,
}: ShouldRefreshCommentsOnMountInput): boolean {
	if (targetCommentId !== null && !hasCommentId(initialComments, targetCommentId)) {
		return true;
	}

	return totalCommentCount > lastReadCommentCount;
}
