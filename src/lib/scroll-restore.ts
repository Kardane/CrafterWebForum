const HOME_SCROLL_KEY = "home_scroll_restore_v1";
const POST_SCROLL_PREFIX = "post_detail_scroll_restore_v1";
const RESTORE_TTL_MS = 30 * 60 * 1000;

interface HomeScrollState {
	search: string;
	scrollY: number;
	savedAt: number;
}

interface PostDetailScrollState {
	anchorCommentId: number | null;
	scrollY: number;
	savedAt: number;
}

function isBrowser(): boolean {
	return typeof window !== "undefined";
}

function isFresh(savedAt: number): boolean {
	return Date.now() - savedAt <= RESTORE_TTL_MS;
}

function toNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	return null;
}

function toOptionalInteger(value: unknown): number | null | undefined {
	if (value === null) {
		return null;
	}
	if (typeof value === "number" && Number.isInteger(value)) {
		return value;
	}
	return undefined;
}

function postScrollKey(postId: number): string {
	return `${POST_SCROLL_PREFIX}:${postId}`;
}

export function saveHomeScrollState(search: string, scrollY: number): void {
	if (!isBrowser()) {
		return;
	}
	const payload: HomeScrollState = {
		search,
		scrollY: Math.max(0, Math.floor(scrollY)),
		savedAt: Date.now(),
	};
	sessionStorage.setItem(HOME_SCROLL_KEY, JSON.stringify(payload));
}

export function readHomeScrollState(search: string): number | null {
	if (!isBrowser()) {
		return null;
	}
	const raw = sessionStorage.getItem(HOME_SCROLL_KEY);
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw) as Partial<HomeScrollState>;
		const savedAt = toNumber(parsed.savedAt);
		const scrollY = toNumber(parsed.scrollY);
		if (
			typeof parsed.search !== "string" ||
			savedAt === null ||
			scrollY === null ||
			!isFresh(savedAt) ||
			parsed.search !== search
		) {
			sessionStorage.removeItem(HOME_SCROLL_KEY);
			return null;
		}
		sessionStorage.removeItem(HOME_SCROLL_KEY);
		return scrollY;
	} catch {
		sessionStorage.removeItem(HOME_SCROLL_KEY);
		return null;
	}
}

export function savePostDetailScrollState(
	postId: number,
	state: { anchorCommentId: number | null; scrollY: number }
): void {
	if (!isBrowser()) {
		return;
	}
	const payload: PostDetailScrollState = {
		anchorCommentId: state.anchorCommentId,
		scrollY: Math.max(0, Math.floor(state.scrollY)),
		savedAt: Date.now(),
	};
	sessionStorage.setItem(postScrollKey(postId), JSON.stringify(payload));
}

export function readPostDetailScrollState(
	postId: number
): { anchorCommentId: number | null; scrollY: number } | null {
	if (!isBrowser()) {
		return null;
	}
	const key = postScrollKey(postId);
	const raw = sessionStorage.getItem(key);
	if (!raw) {
		return null;
	}
	try {
		const parsed = JSON.parse(raw) as Partial<PostDetailScrollState>;
		const savedAt = toNumber(parsed.savedAt);
		const scrollY = toNumber(parsed.scrollY);
		const anchorCommentId = toOptionalInteger(parsed.anchorCommentId);
		if (savedAt === null || scrollY === null || anchorCommentId === undefined || !isFresh(savedAt)) {
			sessionStorage.removeItem(key);
			return null;
		}
		return {
			anchorCommentId,
			scrollY,
		};
	} catch {
		sessionStorage.removeItem(key);
		return null;
	}
}

export function clearPostDetailScrollState(postId: number): void {
	if (!isBrowser()) {
		return;
	}
	sessionStorage.removeItem(postScrollKey(postId));
}
