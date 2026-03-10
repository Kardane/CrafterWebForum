export const OMBUDSMAN_BOARD_MARKER = "__sys:board:ombudsman";
const OMBUDSMAN_SERVER_PREFIX = "__sys:server:";

export type PostBoardType = "develope" | "sinmungo";

export const DEFAULT_POST_BOARD: PostBoardType = "develope";

export function getBoardPath(board: PostBoardType): string {
	return board === "sinmungo" ? "/sinmungo" : "/develope";
}

export function getBoardLabel(board: PostBoardType): string {
	return board === "sinmungo" ? "서버 신문고" : "개발 포스트";
}

export function getBoardNewPostPath(board: PostBoardType): string {
	return board === "sinmungo" ? "/sinmungo/new" : "/posts/new";
}

interface PostTagMetadata {
	board: PostBoardType;
	serverAddress: string | null;
	tags: string[];
}

function parseRawTags(rawTags: string | null): string[] {
	if (!rawTags) {
		return [];
	}
	try {
		const parsed = JSON.parse(rawTags) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter((tag): tag is string => typeof tag === "string");
	} catch {
		return [];
	}
}

export function isReservedPostTag(tag: string): boolean {
	return tag === OMBUDSMAN_BOARD_MARKER || tag.startsWith(OMBUDSMAN_SERVER_PREFIX);
}

export function parsePostTagMetadata(
	rawTags: string | null,
	storedBoard?: string | null,
	storedServerAddress?: string | null
): PostTagMetadata {
	const parsed = parseRawTags(rawTags);
	let board: PostBoardType = normalizeBoardType(storedBoard);
	let serverAddress: string | null = storedServerAddress?.trim() || null;
	const tags: string[] = [];

	for (const tag of parsed) {
		if (tag === OMBUDSMAN_BOARD_MARKER) {
			board = "sinmungo";
			continue;
		}
		if (tag.startsWith(OMBUDSMAN_SERVER_PREFIX)) {
			serverAddress = tag.slice(OMBUDSMAN_SERVER_PREFIX.length) || null;
			continue;
		}
		if (isReservedPostTag(tag)) {
			continue;
		}
		tags.push(tag);
	}

	return {
		board,
		serverAddress,
		tags,
	};
}

export function normalizeBoardType(value: unknown): PostBoardType {
	return value === "sinmungo" ? "sinmungo" : DEFAULT_POST_BOARD;
}

export function toStoredTags(input: {
	tags: string[];
	board?: PostBoardType;
	serverAddress?: string | null;
}): string {
	const filtered = input.tags
		.filter((tag) => typeof tag === "string")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0 && !isReservedPostTag(tag));
	if (input.board === "sinmungo") {
		filtered.unshift(OMBUDSMAN_BOARD_MARKER);
		if (input.serverAddress?.trim()) {
			filtered.unshift(`${OMBUDSMAN_SERVER_PREFIX}${input.serverAddress.trim()}`);
		}
	}
	return JSON.stringify(filtered);
}
