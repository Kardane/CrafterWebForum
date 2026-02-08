const DEFAULT_COMPACT_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_MAX_COMPACT_CHAIN_SIZE = 5;
const REPLY_PREVIEW_MAX_LENGTH = 88;

interface StreamCommentAuthor {
	id: number;
	nickname: string;
}

export interface StreamComment {
	id: number;
	content: string;
	createdAt: string;
	isPinned: boolean;
	parentId: number | null;
	author: StreamCommentAuthor;
	replies: StreamComment[];
}

export interface FlattenedStreamComment<T extends StreamComment = StreamComment> {
	comment: T;
	threadRootId: number;
	replyToName: string | null;
	replyToCommentId: number | null;
	replyToPreview: string | null;
	isCompact: boolean;
}

function stripReplyPreviewContent(content: string): string {
	return content
		.replace(/\[POLL_JSON\][\s\S]*?\[\/POLL_JSON\]/g, " ")
		.replace(/!\[[^\]]*]\(([^)]+)\)/g, "[이미지]")
		.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
		.replace(/`{1,3}[\s\S]*?`{1,3}/g, " ")
		.replace(/[*_~>#-]/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function toReplyPreview(content: string): string {
	const plain = stripReplyPreviewContent(content);
	if (!plain) {
		return "본문 없음";
	}
	if (plain.length <= REPLY_PREVIEW_MAX_LENGTH) {
		return plain;
	}
	return `${plain.slice(0, REPLY_PREVIEW_MAX_LENGTH)}…`;
}

function shouldCompactWithPrevious(
	previous: FlattenedStreamComment | null,
	current: FlattenedStreamComment,
	compactWindowMs: number
): boolean {
	if (!previous) {
		return false;
	}
	if (previous.comment.isPinned || current.comment.isPinned) {
		return false;
	}
	if (previous.comment.author.id !== current.comment.author.id) {
		return false;
	}
	const previousMs = new Date(previous.comment.createdAt).getTime();
	const currentMs = new Date(current.comment.createdAt).getTime();
	if (!Number.isFinite(previousMs) || !Number.isFinite(currentMs) || currentMs < previousMs) {
		return false;
	}
	return currentMs - previousMs <= compactWindowMs;
}

export function flattenCommentsForStream<T extends StreamComment>(
	comments: T[],
	options?: { compactWindowMs?: number; maxCompactChainSize?: number }
): FlattenedStreamComment<T>[] {
	const compactWindowMs = options?.compactWindowMs ?? DEFAULT_COMPACT_WINDOW_MS;
	const maxCompactChainSize = options?.maxCompactChainSize ?? DEFAULT_MAX_COMPACT_CHAIN_SIZE;
	const flattened: FlattenedStreamComment<T>[] = [];

	const walk = (
		nodes: T[],
		rootId: number | null,
		replyToName: string | null,
		replyToCommentId: number | null,
		replyToPreviewText: string | null
	) => {
		nodes.forEach((node) => {
			const nextRootId = rootId ?? node.id;
			flattened.push({
				comment: node,
				threadRootId: nextRootId,
				replyToName,
				replyToCommentId,
				replyToPreview: replyToPreviewText,
				isCompact: false,
			});

			if (node.replies.length > 0) {
				walk(
					node.replies as T[],
					nextRootId,
					node.author.nickname,
					node.id,
					toReplyPreview(node.content)
				);
			}
		});
	};

	walk(comments, null, null, null, null);

	const sorted = [...flattened].sort((a, b) => {
		return new Date(a.comment.createdAt).getTime() - new Date(b.comment.createdAt).getTime();
	});

	let currentChainSize = 0;
	return sorted.map((item, index) => {
		const previous = index > 0 ? sorted[index - 1] : null;
		const canCompact = shouldCompactWithPrevious(previous, item, compactWindowMs);
		if (!canCompact || currentChainSize >= maxCompactChainSize) {
			currentChainSize = 1;
			return {
				...item,
				isCompact: false,
			};
		}

		currentChainSize += 1;
		return {
			...item,
			isCompact: true,
		};
	});
}
