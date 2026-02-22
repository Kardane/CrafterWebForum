import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";

export const dynamic = "force-dynamic";

type LinkPreview = {
	provider: string;
	kind: string;
	badge: string;
	title: string;
	subtitle: string;
	description?: string;
	imageUrl?: string;
	iconUrl?: string;
	authorName?: string;
	authorAvatarUrl?: string;
	status?: string;
	chips: string[];
	metrics: string[];
	stats?: {
		stars?: number;
		forks?: number;
		issues?: number;
		pulls?: number;
		downloads?: number;
		updatedAt?: string;
		version?: string;
		platforms?: string[];
		environments?: string[];
	};
};

const HTTP_TIMEOUT_MS = 4_500;
const LINK_PREVIEW_CACHE_TTL_MS = 60 * 5 * 1_000;
const LINK_PREVIEW_CACHE_MAX_ENTRIES = 500;

type LinkPreviewCacheItem = {
	preview: LinkPreview;
	expiresAt: number;
};

const linkPreviewCache = new Map<string, LinkPreviewCacheItem>();
const REQUEST_HEADERS = {
	"User-Agent": "CrafterForumBot/1.0 (+https://mcbrass.kro.kr)",
	Accept: "application/json,text/html;q=0.9,*/*;q=0.8",
	"Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
} as const;

function toFavicon(hostname: string): string {
	return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
}

function normalizeText(value: unknown, fallback = ""): string {
	if (typeof value !== "string") {
		return fallback;
	}
	return value.replace(/\s+/g, " ").trim();
}

function clampText(value: unknown, maxLength = 180): string | undefined {
	const normalized = normalizeText(value);
	if (!normalized) {
		return undefined;
	}
	return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}…` : normalized;
}

function asRecord(value: unknown): Record<string, unknown> | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}
	return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}
	return null;
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) {
		return [];
	}
	return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function formatMetric(icon: string, value: number, label: string): string {
	return `${icon} ${label} ${value.toLocaleString("ko-KR")}`;
}

function isIpv4Literal(hostname: string): boolean {
	return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function isPrivateIpv4(hostname: string): boolean {
	if (!isIpv4Literal(hostname)) {
		return false;
	}
	const parts = hostname.split(".").map((part) => Number(part));
	if (parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
		return false;
	}
	if (parts[0] === 10 || parts[0] === 127) {
		return true;
	}
	if (parts[0] === 192 && parts[1] === 168) {
		return true;
	}
	if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
		return true;
	}
	return false;
}

function isBlockedHost(hostname: string): boolean {
	const lower = hostname.toLowerCase();
	if (lower === "localhost" || lower.endsWith(".local")) {
		return true;
	}
	if (lower.includes(":")) {
		const ipv6 = lower.replace(/^\[|\]$/g, "");
		if (ipv6 === "::1" || ipv6.startsWith("fe80:") || ipv6.startsWith("fc") || ipv6.startsWith("fd")) {
			return true;
		}
	}
	if (isPrivateIpv4(lower)) {
		return true;
	}
	return false;
}

async function fetchWithTimeout(url: string): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
	try {
		return await fetch(url, {
			headers: REQUEST_HEADERS,
			signal: controller.signal,
			next: { revalidate: 60 * 5 },
		});
	} finally {
		clearTimeout(timeout);
	}
}

function extractMetaContent(html: string, key: string, attr: "property" | "name" = "property"): string | undefined {
	const pattern = new RegExp(`<meta\\s+[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
	const matched = html.match(pattern)?.[1];
	return clampText(matched, 220);
}

function extractHtmlTitle(html: string): string | undefined {
	const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
	return clampText(title, 160);
}

function extractDcAuthor(html: string): string | undefined {
	const patterns = [
		/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i,
		/class=["']gall_writer[^"']*["'][^>]*>\s*<b[^>]*>([^<]+)<\/b>/i,
		/class=["']nickname["'][^>]*>([^<]+)<\/span>/i,
	];
	for (const pattern of patterns) {
		const matched = html.match(pattern)?.[1];
		const normalized = clampText(matched, 80);
		if (normalized) {
			return normalized;
		}
	}
	return undefined;
}

function extractDcDate(html: string): string | undefined {
	const patterns = [
		/class=["']gall_date["'][^>]*title=["']([^"']+)["']/i,
		/data-time=["']([^"']+)["']/i,
		/\b(\d{4}\.\d{2}\.\d{2}\s+\d{2}:\d{2}:\d{2})\b/i,
	];
	for (const pattern of patterns) {
		const matched = html.match(pattern)?.[1];
		const normalized = clampText(matched, 64);
		if (normalized) {
			return normalized;
		}
	}
	return undefined;
}

function fallbackPreview(parsedUrl: URL, provider = "generic", kind = "website"): LinkPreview {
	const hostname = parsedUrl.hostname.replace(/^www\./, "");
	return {
		provider,
		kind,
		badge: hostname,
		title: hostname,
		subtitle: parsedUrl.pathname === "/" ? parsedUrl.toString() : parsedUrl.pathname,
		iconUrl: toFavicon(hostname),
		chips: [],
		metrics: [],
	};
}

function getCachedPreview(url: string): LinkPreview | null {
	const cached = linkPreviewCache.get(url);
	if (!cached) {
		return null;
	}
	if (cached.expiresAt <= Date.now()) {
		linkPreviewCache.delete(url);
		return null;
	}
	return cached.preview;
}

function setCachedPreview(url: string, preview: LinkPreview) {
	if (linkPreviewCache.has(url)) {
		linkPreviewCache.delete(url);
	}
	linkPreviewCache.set(url, {
		preview,
		expiresAt: Date.now() + LINK_PREVIEW_CACHE_TTL_MS,
	});
	if (linkPreviewCache.size > LINK_PREVIEW_CACHE_MAX_ENTRIES) {
		const oldestKey = linkPreviewCache.keys().next().value;
		if (oldestKey) {
			linkPreviewCache.delete(oldestKey);
		}
	}
}

async function buildGitHubPreview(parsedUrl: URL): Promise<LinkPreview> {
	const iconUrl = toFavicon("github.com");
	const segments = parsedUrl.pathname.split("/").filter(Boolean);

	if (segments.length === 1) {
		const login = segments[0];
		const response = await fetchWithTimeout(`https://api.github.com/users/${encodeURIComponent(login)}`);
		if (!response.ok) {
			return {
				...fallbackPreview(parsedUrl, "github", "profile"),
				badge: "GitHub",
				title: `@${login}`,
				subtitle: "GitHub 프로필",
				iconUrl,
			};
		}
		const user = asRecord(await response.json());
		const followers = asNumber(user?.followers) ?? 0;
		const following = asNumber(user?.following) ?? 0;
		const repos = asNumber(user?.public_repos) ?? 0;
		return {
			provider: "github",
			kind: "profile",
			badge: "GitHub",
			title: normalizeText(user?.name, `@${login}`),
			subtitle: `@${normalizeText(user?.login, login)}`,
			description: clampText(user?.bio),
			imageUrl: normalizeText(user?.avatar_url),
			iconUrl,
			chips: [formatMetric("📦", repos, "레포")],
			metrics: [formatMetric("👥", followers, "팔로워"), formatMetric("➡", following, "팔로잉")],
		};
	}

	if (segments.length < 2) {
		return {
			...fallbackPreview(parsedUrl, "github", "other"),
			badge: "GitHub",
			iconUrl,
		};
	}

	const [owner, repo, section, sectionId] = segments;
	const repoPath = `${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
	const repoResponse = await fetchWithTimeout(`https://api.github.com/repos/${repoPath}`);
	const repoData = repoResponse.ok ? asRecord(await repoResponse.json()) : null;
	const repositoryTitle = `${owner}/${repo}`;
	const repositoryDescription = clampText(repoData?.description);
	const repositoryAvatar = normalizeText(asRecord(repoData?.owner)?.avatar_url);
	const repositoryChips = [
		clampText(repoData?.language, 32),
	].filter((item): item is string => Boolean(item));
	const repositoryStats = {
		stars: asNumber(repoData?.stargazers_count) ?? 0,
		forks: asNumber(repoData?.forks_count) ?? 0,
		issues: asNumber(repoData?.open_issues_count) ?? 0,
		updatedAt: normalizeText(repoData?.pushed_at || repoData?.updated_at),
		version: clampText(repoData?.language, 32),
	};

	if (section === "issues" && sectionId) {
		const issueResponse = await fetchWithTimeout(`https://api.github.com/repos/${repoPath}/issues/${encodeURIComponent(sectionId)}`);
		const issue = issueResponse.ok ? asRecord(await issueResponse.json()) : null;
		return {
			provider: "github",
			kind: "issue",
			badge: "GitHub",
			title: normalizeText(issue?.title, `${repositoryTitle} · Issue #${sectionId}`),
			subtitle: `${repositoryTitle} · Issue #${sectionId}`,
			description: clampText(issue?.body),
			imageUrl: repositoryAvatar,
			iconUrl,
			authorName: normalizeText(asRecord(issue?.user)?.login),
			authorAvatarUrl: normalizeText(asRecord(issue?.user)?.avatar_url),
			status: normalizeText(issue?.state, "unknown").toUpperCase(),
			chips: repositoryChips,
			metrics: [formatMetric("💬", asNumber(issue?.comments) ?? 0, "댓글")],
			stats: {
				...repositoryStats,
				issues: asNumber(issue?.comments) ?? 0, // In issue context, this is comments
			}
		};
	}

	if (section === "pull" && sectionId) {
		const pullResponse = await fetchWithTimeout(`https://api.github.com/repos/${repoPath}/pulls/${encodeURIComponent(sectionId)}`);
		const pull = pullResponse.ok ? asRecord(await pullResponse.json()) : null;
		const state = normalizeText(pull?.state, "unknown").toUpperCase();
		const mergedAt = normalizeText(pull?.merged_at);
		return {
			provider: "github",
			kind: "pull_request",
			badge: "GitHub",
			title: normalizeText(pull?.title, `${repositoryTitle} · PR #${sectionId}`),
			subtitle: `${repositoryTitle} · PR #${sectionId}`,
			description: clampText(pull?.body),
			imageUrl: repositoryAvatar,
			iconUrl,
			authorName: normalizeText(asRecord(pull?.user)?.login),
			authorAvatarUrl: normalizeText(asRecord(pull?.user)?.avatar_url),
			status: mergedAt ? "MERGED" : state,
			chips: repositoryChips,
			metrics: [
				formatMetric("🧩", asNumber(pull?.commits) ?? 0, "커밋"),
				formatMetric("💬", asNumber(pull?.comments) ?? 0, "댓글"),
			],
			stats: {
				...repositoryStats,
				pulls: asNumber(pull?.commits) ?? 0,
				issues: asNumber(pull?.comments) ?? 0,
			}
		};
	}

	if (section === "wiki") {
		const wikiTitleRaw = segments.slice(3).join("/") || "Home";
		let wikiTitle = wikiTitleRaw;
		try {
			wikiTitle = decodeURIComponent(wikiTitleRaw);
		} catch {
			wikiTitle = wikiTitleRaw;
		}
		return {
			provider: "github",
			kind: "wiki",
			badge: "GitHub",
			title: wikiTitle,
			subtitle: `${repositoryTitle} · Wiki`,
			description: repositoryDescription,
			imageUrl: repositoryAvatar,
			iconUrl,
			chips: repositoryChips,
			metrics: [],
		};
	}

	if (section === "releases") {
		return {
			provider: "github",
			kind: "release",
			badge: "GitHub",
			title: repositoryTitle,
			subtitle: `${repositoryTitle} · Releases`,
			description: repositoryDescription,
			imageUrl: repositoryAvatar,
			iconUrl,
			chips: repositoryChips,
			metrics: [
				formatMetric("★", repositoryStats.stars, "스타"),
				formatMetric("⑂", repositoryStats.forks, "포크"),
			],
			stats: repositoryStats,
		};
	}

	return {
		provider: "github",
		kind: "repository",
		badge: "GitHub",
		title: repositoryTitle,
		subtitle: "GitHub 저장소",
		description: repositoryDescription,
		imageUrl: repositoryAvatar,
		iconUrl,
		chips: repositoryChips,
		metrics: [
			formatMetric("★", repositoryStats.stars, "스타"),
			formatMetric("⑂", repositoryStats.forks, "포크"),
		],
		stats: repositoryStats,
	};
}

async function buildModrinthPreview(parsedUrl: URL): Promise<LinkPreview> {
	const iconUrl = toFavicon("modrinth.com");
	const segments = parsedUrl.pathname.split("/").filter(Boolean);
	const projectSlug = segments[1] ?? "";

	if (!projectSlug) {
		return {
			...fallbackPreview(parsedUrl, "modrinth", "other"),
			badge: "Modrinth",
			iconUrl,
		};
	}

	const projectResponse = await fetchWithTimeout(`https://api.modrinth.com/v2/project/${encodeURIComponent(projectSlug)}`);
	if (!projectResponse.ok) {
		return {
			...fallbackPreview(parsedUrl, "modrinth", "other"),
			badge: "Modrinth",
			iconUrl,
			title: projectSlug,
			subtitle: "Modrinth 프로젝트",
		};
	}

	const project = asRecord(await projectResponse.json());
	const teamId = normalizeText(project?.team);
	let authorName = "";
	let authorAvatarUrl = "";
	if (teamId) {
		const teamResponse = await fetchWithTimeout(`https://api.modrinth.com/v2/team/${encodeURIComponent(teamId)}/members`);
		if (teamResponse.ok) {
			const members = await teamResponse.json();
			if (Array.isArray(members) && members.length > 0) {
				const firstMember = asRecord(members[0]);
				const user = asRecord(firstMember?.user);
				authorName = normalizeText(user?.username);
				authorAvatarUrl = normalizeText(user?.avatar_url);
			}
		}
	}

	const gameVersions = asStringArray(project?.game_versions);
	const loaders = asStringArray(project?.loaders);
	const categories = asStringArray(project?.categories);

	return {
		provider: "modrinth",
		kind: "project",
		badge: "Modrinth",
		title: normalizeText(project?.title, projectSlug),
		subtitle: normalizeText(project?.project_type, "프로젝트"),
		description: clampText(project?.description),
		imageUrl: normalizeText(project?.icon_url),
		iconUrl,
		authorName: authorName || undefined,
		authorAvatarUrl: authorAvatarUrl || undefined,
		chips: categories.map(c => `#${c}`),
		metrics: [
			formatMetric("⬇", asNumber(project?.downloads) ?? 0, "다운로드"),
			formatMetric("❤", asNumber(project?.followers) ?? 0, "좋아요"),
		],
		stats: {
			downloads: asNumber(project?.downloads) ?? 0,
			updatedAt: normalizeText(project?.updated),
			version: gameVersions[0],
			platforms: gameVersions,
			environments: loaders,
		}
	};
}

async function buildCurseForgePreview(parsedUrl: URL): Promise<LinkPreview> {
	const iconUrl = toFavicon("curseforge.com");
	const response = await fetchWithTimeout(parsedUrl.toString());
	if (!response.ok) {
		return {
			...fallbackPreview(parsedUrl, "curseforge", "project"),
			badge: "CurseForge",
			iconUrl,
		};
	}

	const html = await response.text();
	const title = extractMetaContent(html, "og:title") ?? extractHtmlTitle(html) ?? "CurseForge 프로젝트";
	const description = extractMetaContent(html, "og:description") ?? extractMetaContent(html, "description", "name");
	const imageUrl = extractMetaContent(html, "og:image");

	// Scraping specific fields from legacy layout if possible
	const authorMatch = html.match(/<span class="author">by\s*<a[^>]*>([^<]+)<\/a>/i);
	const downloadMatch = html.match(/<div class="info-data">([\d,]+)\s*Downloads<\/div>/i);
	const updatedMatch = html.match(/Updated\s*<abbr[^>]*title="([^"]+)"/i);

	const downloads = downloadMatch ? parseInt(downloadMatch[1].replace(/,/g, ""), 10) : 0;

	return {
		provider: "curseforge",
		kind: "project",
		badge: "CurseForge",
		title,
		subtitle: "CurseForge 프로젝트",
		description,
		imageUrl,
		iconUrl,
		authorName: authorMatch?.[1]?.trim(),
		chips: ["Minecraft"],
		metrics: downloads > 0 ? [formatMetric("⬇", downloads, "다운로드")] : [],
		stats: {
			downloads,
			updatedAt: updatedMatch?.[1],
		}
	};
}

async function buildDcinsidePreview(parsedUrl: URL): Promise<LinkPreview> {
	const hostname = parsedUrl.hostname.replace(/^www\./, "");
	const response = await fetchWithTimeout(parsedUrl.toString());
	if (!response.ok) {
		return {
			...fallbackPreview(parsedUrl, "dcinside", "article"),
			badge: "DCinside",
			iconUrl: toFavicon("dcinside.com"),
		};
	}

	const html = await response.text();
	const title = extractMetaContent(html, "og:title") ?? extractHtmlTitle(html) ?? "디시인사이드 링크";
	const description = extractMetaContent(html, "og:description") ?? extractMetaContent(html, "description", "name");
	const imageUrl = extractMetaContent(html, "og:image");
	const author = extractDcAuthor(html);
	const date = extractDcDate(html);
	const chips = [author ? `작성자 ${author}` : "", date ? `작성일 ${date}` : ""].filter((chip) => chip.length > 0);

	return {
		provider: "dcinside",
		kind: "article",
		badge: "DCinside",
		title,
		subtitle: hostname,
		description,
		imageUrl,
		iconUrl: toFavicon("dcinside.com"),
		authorName: author,
		chips,
		metrics: [],
	};
}

async function buildGenericPreview(parsedUrl: URL): Promise<LinkPreview> {
	const hostname = parsedUrl.hostname.replace(/^www\./, "");
	const response = await fetchWithTimeout(parsedUrl.toString());
	if (!response.ok) {
		return fallbackPreview(parsedUrl, "generic", "website");
	}

	const html = await response.text();
	const title = extractMetaContent(html, "og:title") ?? extractHtmlTitle(html) ?? hostname;
	const description = extractMetaContent(html, "og:description") ?? extractMetaContent(html, "description", "name");
	const imageUrl = extractMetaContent(html, "og:image");
	return {
		provider: "generic",
		kind: "website",
		badge: hostname,
		title,
		subtitle: parsedUrl.pathname === "/" ? parsedUrl.toString() : parsedUrl.pathname,
		description,
		imageUrl,
		iconUrl: toFavicon(hostname),
		chips: [],
		metrics: [],
	};
}

export async function GET(request: NextRequest) {
	try {
		const rateLimitedResponse = enforceRateLimit(request, RATE_LIMIT_POLICIES.linkPreview);
		if (rateLimitedResponse) {
			return rateLimitedResponse;
		}

		const rawUrl = request.nextUrl.searchParams.get("url")?.trim() ?? "";
		if (!rawUrl || rawUrl.length > 2048) {
			return NextResponse.json({ error: "invalid_request" }, { status: 400 });
		}

		let parsedUrl: URL;
		try {
			parsedUrl = new URL(rawUrl);
		} catch {
			return NextResponse.json({ error: "invalid_request" }, { status: 400 });
		}

		if (!["http:", "https:"].includes(parsedUrl.protocol)) {
			return NextResponse.json({ error: "invalid_request" }, { status: 400 });
		}

		if (isBlockedHost(parsedUrl.hostname)) {
			return NextResponse.json({ error: "invalid_request" }, { status: 400 });
		}

		const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
		const normalizedUrl = parsedUrl.toString();
		const cachedPreview = getCachedPreview(normalizedUrl);
		if (cachedPreview) {
			return NextResponse.json(
				{ preview: cachedPreview },
				{
					status: 200,
					headers: {
						"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
					},
				}
			);
		}

		let preview: LinkPreview;
		if (hostname === "github.com") {
			preview = await buildGitHubPreview(parsedUrl);
		} else if (hostname === "modrinth.com") {
			preview = await buildModrinthPreview(parsedUrl);
		} else if (hostname === "curseforge.com" || hostname === "legacy.curseforge.com") {
			preview = await buildCurseForgePreview(parsedUrl);
		} else if (hostname === "dcinside.com" || hostname === "gall.dcinside.com" || hostname === "m.dcinside.com") {
			preview = await buildDcinsidePreview(parsedUrl);
		} else {
			preview = await buildGenericPreview(parsedUrl);
		}

		setCachedPreview(normalizedUrl, preview);

		return NextResponse.json(
			{ preview },
			{
				status: 200,
				headers: {
					"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
				},
			}
		);
	} catch (error) {
		console.error("[API] GET /api/link-preview error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
