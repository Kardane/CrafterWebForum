"use client";

interface CommentLocationLike {
	search: string;
	hash: string;
}

function resolveLocation(input?: CommentLocationLike): CommentLocationLike | null {
	if (input) {
		return input;
	}
	if (typeof window === "undefined") {
		return null;
	}
	return window.location;
}

export function parseTargetCommentIdFromLocation(input?: CommentLocationLike): number | null {
	const locationLike = resolveLocation(input);
	if (!locationLike) {
		return null;
	}

	const searchParams = new URLSearchParams(locationLike.search);
	const queryCommentId = Number.parseInt(searchParams.get("commentId") ?? "", 10);
	if (Number.isInteger(queryCommentId) && queryCommentId > 0) {
		return queryCommentId;
	}

	const hashMatched = locationLike.hash.match(/^#comment-(\d+)$/);
	if (!hashMatched) {
		return null;
	}

	const hashCommentId = Number.parseInt(hashMatched[1] ?? "", 10);
	if (!Number.isInteger(hashCommentId) || hashCommentId <= 0) {
		return null;
	}

	return hashCommentId;
}

export function hasTargetCommentInLocation(input?: CommentLocationLike): boolean {
	return parseTargetCommentIdFromLocation(input) !== null;
}
