const MENTION_REGEX = /@([^\s@.,!?;:()\[\]{}<>"'`~\/\\]+)/g;
const MAX_MENTION_COUNT = 10;

export function extractMentionNicknames(content: string): string[] {
	if (!content) {
		return [];
	}

	const seen = new Set<string>();
	const result: string[] = [];
	for (const match of content.matchAll(MENTION_REGEX)) {
		const nickname = (match[1] ?? "").trim();
		if (!nickname) {
			continue;
		}
		if (seen.has(nickname)) {
			continue;
		}
		seen.add(nickname);
		result.push(nickname);
		if (result.length >= MAX_MENTION_COUNT) {
			break;
		}
	}

	return result;
}
