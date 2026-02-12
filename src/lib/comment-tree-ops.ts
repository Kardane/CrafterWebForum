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
