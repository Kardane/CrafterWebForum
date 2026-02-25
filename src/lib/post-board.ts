export const OMBUDSMAN_BOARD_MARKER = "__sys:board:ombudsman";
const OMBUDSMAN_SERVER_PREFIX = "__sys:server:";

export type PostBoardType = "forum" | "ombudsman";

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

export function parsePostTagMetadata(rawTags: string | null): PostTagMetadata {
	const parsed = parseRawTags(rawTags);
	let board: PostBoardType = "forum";
	let serverAddress: string | null = null;
	const tags: string[] = [];

	for (const tag of parsed) {
		if (tag === OMBUDSMAN_BOARD_MARKER) {
			board = "ombudsman";
			continue;
		}
		if (tag.startsWith(OMBUDSMAN_SERVER_PREFIX)) {
			const rawAddress = tag.slice(OMBUDSMAN_SERVER_PREFIX.length).trim();
			if (rawAddress) {
				serverAddress = rawAddress;
			}
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
	if (value === "ombudsman") {
		return "ombudsman";
	}
	return "forum";
}

export function toStoredTags(input: {
	board: PostBoardType;
	tags: string[];
	serverAddress?: string | null;
}): string {
	if (input.board === "ombudsman") {
		const metadataTags = [OMBUDSMAN_BOARD_MARKER];
		if (input.serverAddress && input.serverAddress.trim().length > 0) {
			metadataTags.push(`${OMBUDSMAN_SERVER_PREFIX}${input.serverAddress.trim()}`);
		}
		return JSON.stringify(metadataTags);
	}

	const filtered = input.tags
		.filter((tag) => typeof tag === "string")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0 && !isReservedPostTag(tag));
	return JSON.stringify(filtered);
}
