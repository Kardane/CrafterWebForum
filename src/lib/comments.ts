export interface CommentTreeAuthor {
	id: number;
	nickname: string;
	minecraftUuid: string | null;
	role: string;
}

export interface CommentTreeNode {
	id: number;
	content: string;
	createdAt: Date;
	updatedAt: Date;
	isPinned: boolean;
	parentId: number | null;
	author: CommentTreeAuthor;
	replies: CommentTreeNode[];
}

interface CommentWithAuthor {
	id: number;
	content: string;
	createdAt: Date;
	updatedAt: Date;
	isPinned: number | boolean;
	parentId: number | null;
	author: CommentTreeAuthor;
}

export function buildCommentTree(comments: CommentWithAuthor[]): CommentTreeNode[] {
	const commentMap = new Map<number, CommentTreeNode>();
	const rootComments: CommentTreeNode[] = [];

	for (const comment of comments) {
		const node: CommentTreeNode = {
			id: comment.id,
			content: comment.content,
			createdAt: comment.createdAt,
			updatedAt: comment.updatedAt,
			isPinned: Boolean(comment.isPinned),
			parentId: comment.parentId,
			author: comment.author,
			replies: [],
		};

		commentMap.set(node.id, node);

		if (node.parentId === null) {
			rootComments.push(node);
		}
	}

	for (const comment of comments) {
		if (comment.parentId === null) {
			continue;
		}

		const parent = commentMap.get(comment.parentId);
		const child = commentMap.get(comment.id);
		if (parent && child) {
			parent.replies.push(child);
		}
	}

	return rootComments;
}
