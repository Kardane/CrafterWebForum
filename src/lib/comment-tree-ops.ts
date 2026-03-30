/**
 * 댓글 트리 순수 조작 함수 모음
 * CommentSection에서 사용하는 불변 트리 변환 유틸리티
 */

// 댓글 트리 노드 인터페이스
export interface Comment {
	id: number;
	content: string;
	createdAt: string;
	updatedAt: string;
	isPinned: boolean;
	parentId: number | null;
	isPostAuthor: boolean;
	author: {
		id: number;
		nickname: string;
		minecraftUuid: string | null;
		role: string;
	};
	replies: Comment[];
}

// 최근 댓글 청크 크기
export const LATEST_CHUNK_SIZE = 40;
// 스레드 접기 임계값 (답글이 이 수 이상이면 접기 가능)
export const THREAD_COLLAPSE_THRESHOLD = 8;
// 스크롤 상태 저장 디바운스 딜레이 (ms)
export const DETAIL_SCROLL_SAVE_DELAY_MS = 240;

interface MergeLatestWindowCommentsResult {
	comments: Comment[];
	didChange: boolean;
	shouldFallbackToFullReload: boolean;
}

function hasCommentId(nodes: Comment[], targetId: number): boolean {
	for (const node of nodes) {
		if (node.id === targetId) {
			return true;
		}
		if (node.replies.length > 0 && hasCommentId(node.replies, targetId)) {
			return true;
		}
	}
	return false;
}

function mergeCommentSnapshot(existing: Comment, incoming: Comment): Comment {
	if (
		existing.content === incoming.content &&
		existing.createdAt === incoming.createdAt &&
		existing.updatedAt === incoming.updatedAt &&
		existing.isPinned === incoming.isPinned &&
		existing.parentId === incoming.parentId &&
		existing.isPostAuthor === incoming.isPostAuthor &&
		existing.author.id === incoming.author.id &&
		existing.author.nickname === incoming.author.nickname &&
		existing.author.minecraftUuid === incoming.author.minecraftUuid &&
		existing.author.role === incoming.author.role
	) {
		return existing;
	}

	return {
		...existing,
		content: incoming.content,
		createdAt: incoming.createdAt,
		updatedAt: incoming.updatedAt,
		isPinned: incoming.isPinned,
		parentId: incoming.parentId,
		isPostAuthor: incoming.isPostAuthor,
		author: incoming.author,
	};
}

function mergeReplyList(
	parentId: number,
	existingReplies: Comment[],
	incomingReplies: Comment[]
): MergeLatestWindowCommentsResult {
	let nextReplies = existingReplies;
	let didChange = false;

	for (const incomingReply of incomingReplies) {
		if (incomingReply.parentId === null) {
			return {
				comments: existingReplies,
				didChange: false,
				shouldFallbackToFullReload: true,
			};
		}

		if (!hasCommentId(nextReplies, incomingReply.id)) {
			if (incomingReply.parentId === parentId) {
				nextReplies = [...nextReplies, incomingReply];
				didChange = true;
				continue;
			}
			if (!hasCommentId(nextReplies, incomingReply.parentId)) {
				return {
					comments: existingReplies,
					didChange: false,
					shouldFallbackToFullReload: true,
				};
			}
			nextReplies = appendReplyToThread(nextReplies, incomingReply.parentId, incomingReply);
			didChange = true;
			continue;
		}

		const mergeResult = mergeIncomingCommentIntoNodes(nextReplies, incomingReply);
		if (mergeResult.shouldFallbackToFullReload) {
			return mergeResult;
		}
		nextReplies = mergeResult.comments;
		didChange = didChange || mergeResult.didChange;
	}

	return {
		comments: nextReplies,
		didChange,
		shouldFallbackToFullReload: false,
	};
}

function mergeIncomingCommentIntoNodes(
	nodes: Comment[],
	incoming: Comment
): MergeLatestWindowCommentsResult {
	for (let index = 0; index < nodes.length; index += 1) {
		const node = nodes[index];
		if (node.id === incoming.id) {
			const mergedSnapshot = mergeCommentSnapshot(node, incoming);
			const mergedReplies = mergeReplyList(incoming.id, mergedSnapshot.replies, incoming.replies);
			if (mergedReplies.shouldFallbackToFullReload) {
				return mergedReplies;
			}

			const nextNode =
				mergedSnapshot === node && mergedReplies.comments === node.replies
					? node
					: { ...mergedSnapshot, replies: mergedReplies.comments };
			if (nextNode === node) {
				return {
					comments: nodes,
					didChange: false,
					shouldFallbackToFullReload: false,
				};
			}

			const nextNodes = [...nodes];
			nextNodes[index] = nextNode;
			return {
				comments: nextNodes,
				didChange: true,
				shouldFallbackToFullReload: false,
			};
		}

		if (node.replies.length === 0) {
			continue;
		}

		const nestedResult = mergeIncomingCommentIntoNodes(node.replies, incoming);
		if (nestedResult.shouldFallbackToFullReload) {
			return nestedResult;
		}
		if (!nestedResult.didChange) {
			continue;
		}

		const nextNodes = [...nodes];
		nextNodes[index] = {
			...node,
			replies: nestedResult.comments,
		};
		return {
			comments: nextNodes,
			didChange: true,
			shouldFallbackToFullReload: false,
		};
	}

	return {
		comments: nodes,
		didChange: false,
		shouldFallbackToFullReload: false,
	};
}

export function mergeLatestWindowComments(
	existingComments: Comment[],
	latestWindowComments: Comment[]
): MergeLatestWindowCommentsResult {
	let nextComments = existingComments;
	let didChange = false;

	for (const incomingRoot of latestWindowComments) {
		if (incomingRoot.parentId !== null) {
			return {
				comments: existingComments,
				didChange: false,
				shouldFallbackToFullReload: true,
			};
		}

		if (!hasCommentId(nextComments, incomingRoot.id)) {
			nextComments = [...nextComments, incomingRoot];
			didChange = true;
			continue;
		}

		const mergeResult = mergeIncomingCommentIntoNodes(nextComments, incomingRoot);
		if (mergeResult.shouldFallbackToFullReload) {
			return {
				comments: existingComments,
				didChange: false,
				shouldFallbackToFullReload: true,
			};
		}
		nextComments = mergeResult.comments;
		didChange = didChange || mergeResult.didChange;
	}

	return {
		comments: nextComments,
		didChange,
		shouldFallbackToFullReload: false,
	};
}

/**
 * 특정 루트 댓글의 replies 배열 끝에 새 답글 추가 (불변)
 */
export function appendReplyToThread(nodes: Comment[], rootId: number, newComment: Comment): Comment[] {
	return nodes.map((node) => {
		if (node.id === rootId) {
			return {
				...node,
				replies: [...node.replies, newComment],
			};
		}
		if (node.replies.length === 0) {
			return node;
		}
		return {
			...node,
			replies: appendReplyToThread(node.replies, rootId, newComment),
		};
	});
}

/**
 * 트리에서 특정 댓글의 content/updatedAt 업데이트 (불변)
 */
export function updateCommentInTree(nodes: Comment[], targetId: number, content: string, updatedAt: string): Comment[] {
	return nodes.map((node) => {
		if (node.id === targetId) {
			return {
				...node,
				content,
				updatedAt,
			};
		}
		if (node.replies.length === 0) {
			return node;
		}
		return {
			...node,
			replies: updateCommentInTree(node.replies, targetId, content, updatedAt),
		};
	});
}

/**
 * 트리에서 특정 댓글 제거 (불변, 재귀)
 */
export function removeCommentFromTree(nodes: Comment[], targetId: number): Comment[] {
	return nodes
		.filter((node) => node.id !== targetId)
		.map((node) => ({
			...node,
			replies: removeCommentFromTree(node.replies, targetId),
		}));
}

/**
 * 트리에서 특정 댓글의 isPinned 상태 토글 (불변)
 */
export function updateCommentPinnedInTree(nodes: Comment[], targetId: number, isPinned: boolean): Comment[] {
	return nodes.map((node) => {
		if (node.id === targetId) {
			return {
				...node,
				isPinned,
			};
		}
		if (node.replies.length === 0) {
			return node;
		}
		return {
			...node,
			replies: updateCommentPinnedInTree(node.replies, targetId, isPinned),
		};
	});
}

/**
 * 읽음 마커 삽입 위치 계산
 * 마지막으로 읽은 댓글 이후(= lastReadCommentCount 인덱스)에 마커 표시
 */
export function getReadMarkerIndex(total: number, lastReadCommentCount: number): number | null {
	if (total <= 0 || lastReadCommentCount <= 0 || lastReadCommentCount >= total) {
		return null;
	}
	return lastReadCommentCount;
}

/**
 * DOM element id (예: "comment-123")에서 댓글 ID 파싱
 */
export function parseCommentIdFromElementId(rawId: string): number | null {
	const value = rawId.replace("comment-", "");
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return null;
	}
	return parsed;
}
