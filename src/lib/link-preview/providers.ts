import type { LinkPreview } from "@/lib/link-preview/types";

const HTTP_TIMEOUT_MS = 4_500;
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

export function isBlockedLinkPreviewHost(hostname: string): boolean {
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

async function fetchGitHubWithTimeout(url: string): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
	try {
		const headers: Record<string, string> = {
			...REQUEST_HEADERS,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		};
		const token = (process.env.GITHUB_TOKEN ?? "").trim();
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}
		return await fetch(url, {
			headers,
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

async function buildGitHubPreview(parsedUrl: URL): Promise<LinkPreview> {
	const iconUrl = toFavicon("github.com");
	const segments = parsedUrl.pathname.split("/").filter(Boolean);

	if (segments.length === 1) {
		const login = segments[0];
		const response = await fetchGitHubWithTimeout(`https://api.github.com/users/${encodeURIComponent(login)}`);
		if (!response.ok) {
			return {
				...fallbackPreview(parsedUrl, "github", "profile"),
				badge: "GitHub 프로필",
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
			badge: "GitHub 프로필",
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
	const repoResponse = await fetchGitHubWithTimeout(`https://api.github.com/repos/${repoPath}`);
	const repoData = repoResponse.ok ? asRecord(await repoResponse.json()) : null;
	const repositoryTitle = `${owner}/${repo}`;
	const repositoryDescription = clampText(repoData?.description);
	const ownerData = asRecord(repoData?.owner);
	const repositoryAvatar = normalizeText(ownerData?.avatar_url);
	const repositoryOwnerLogin = normalizeText(ownerData?.login, owner);
	const repositoryOwnerLabel = repositoryOwnerLogin ? `@${repositoryOwnerLogin}` : `@${owner}`;
	const licenseId = normalizeText(asRecord(repoData?.license)?.spdx_id);
	const repoVisibility = normalizeText(repoData?.visibility);
	const isArchived = Boolean(repoData?.archived);
	const isFork = Boolean(repoData?.fork);
	const repositoryChips = [
		clampText(repoData?.language, 32),
		repoVisibility ? `가시성 ${repoVisibility}` : "",
		licenseId && licenseId !== "NOASSERTION" ? `라이선스 ${licenseId}` : "",
		isArchived ? "archived" : "",
		isFork ? "fork" : "",
	]
		.filter((item): item is string => Boolean(item))
		.slice(0, 4);
	const repositoryStats = {
		stars: asNumber(repoData?.stargazers_count) ?? 0,
		forks: asNumber(repoData?.forks_count) ?? 0,
		issues: asNumber(repoData?.open_issues_count) ?? 0,
		updatedAt: normalizeText(repoData?.pushed_at || repoData?.updated_at),
	};
	const repositoryCardStats = {
		stars: repositoryStats.stars,
		issues: repositoryStats.issues,
	};

	if (section === "issues" && sectionId) {
		const issueResponse = await fetchGitHubWithTimeout(
			`https://api.github.com/repos/${repoPath}/issues/${encodeURIComponent(sectionId)}`
		);
		const issue = issueResponse.ok ? asRecord(await issueResponse.json()) : null;
		const issueAuthor = asRecord(issue?.user);
		const issueComments = asNumber(issue?.comments) ?? 0;
		const labels = Array.isArray(issue?.labels)
			? (issue.labels
					.map((label) => normalizeText(asRecord(label)?.name))
					.filter((value) => value.length > 0) as string[])
			: [];
		const stateRaw = normalizeText(issue?.state, "unknown").toUpperCase();
		return {
			provider: "github",
			kind: "issue",
			badge: "GitHub 이슈",
			title: normalizeText(issue?.title, `${repositoryTitle} · Issue #${sectionId}`),
			subtitle: `${repositoryTitle} · Issue #${sectionId}`,
			description: clampText(issue?.body),
			imageUrl: repositoryAvatar,
			iconUrl,
			authorName: normalizeText(issueAuthor?.login),
			authorAvatarUrl: normalizeText(issueAuthor?.avatar_url),
			status: stateRaw,
			chips: [...repositoryChips, ...labels.slice(0, 3), labels.length > 3 ? `+${labels.length - 3}` : ""].filter(
				(item) => item.length > 0
			),
			metrics: [formatMetric("💬", issueComments, "댓글")],
			stats: {
				stars: repositoryStats.stars,
				forks: repositoryStats.forks,
				updatedAt: repositoryStats.updatedAt,
			},
		};
	}

	if ((section === "pull" || section === "pulls") && sectionId) {
		const pullResponse = await fetchGitHubWithTimeout(
			`https://api.github.com/repos/${repoPath}/pulls/${encodeURIComponent(sectionId)}`
		);
		const pull = pullResponse.ok ? asRecord(await pullResponse.json()) : null;
		const state = normalizeText(pull?.state, "unknown").toUpperCase();
		const mergedAt = normalizeText(pull?.merged_at);
		const isDraft = Boolean(pull?.draft);
		const pullAuthor = asRecord(pull?.user);
		const commits = asNumber(pull?.commits) ?? 0;
		const changedFiles = asNumber(pull?.changed_files) ?? 0;
		const additions = asNumber(pull?.additions) ?? 0;
		const deletions = asNumber(pull?.deletions) ?? 0;
		const pullComments = asNumber(pull?.comments) ?? 0;
		const reviewComments = asNumber(pull?.review_comments) ?? 0;
		const baseRef = normalizeText(asRecord(pull?.base)?.ref);
		const headRef = normalizeText(asRecord(pull?.head)?.ref);
		return {
			provider: "github",
			kind: "pull_request",
			badge: "GitHub PR",
			title: normalizeText(pull?.title, `${repositoryTitle} · PR #${sectionId}`),
			subtitle: `${repositoryTitle} · PR #${sectionId}`,
			description: clampText(pull?.body),
			imageUrl: repositoryAvatar,
			iconUrl,
			authorName: normalizeText(pullAuthor?.login),
			authorAvatarUrl: normalizeText(pullAuthor?.avatar_url),
			status: mergedAt ? "MERGED" : isDraft ? "DRAFT" : state,
			chips: [
				...repositoryChips,
				baseRef && headRef ? `${headRef} → ${baseRef}` : "",
				isDraft ? "draft" : "",
			]
				.filter((item) => item.length > 0)
				.slice(0, 4),
			metrics: [
				formatMetric("🧩", commits, "커밋"),
				formatMetric("📄", changedFiles, "파일"),
				formatMetric("＋", additions, "추가"),
				formatMetric("－", deletions, "삭제"),
				formatMetric("💬", pullComments + reviewComments, "댓글"),
			],
			stats: {
				stars: repositoryStats.stars,
				forks: repositoryStats.forks,
				updatedAt: repositoryStats.updatedAt,
			},
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
			badge: "GitHub Wiki",
			title: wikiTitle,
			subtitle: `${repositoryTitle} · Wiki`,
			description: repositoryDescription,
			imageUrl: repositoryAvatar,
			iconUrl,
			authorName: repositoryOwnerLabel,
			authorAvatarUrl: repositoryAvatar,
			chips: repositoryChips,
			metrics: [],
			stats: {
				stars: repositoryStats.stars,
				forks: repositoryStats.forks,
				updatedAt: repositoryStats.updatedAt,
			},
		};
	}

	if (section === "releases") {
		return {
			provider: "github",
			kind: "release",
			badge: "GitHub 릴리스",
			title: repositoryTitle,
			subtitle: `${repositoryTitle} · Releases`,
			description: repositoryDescription,
			imageUrl: repositoryAvatar,
			iconUrl,
			authorName: repositoryOwnerLabel,
			authorAvatarUrl: repositoryAvatar,
			chips: repositoryChips,
			metrics: [],
			stats: repositoryStats,
		};
	}

	return {
		provider: "github",
		kind: "repository",
		badge: "GitHub 저장소",
		title: repositoryTitle,
		subtitle: "GitHub 저장소",
		description: repositoryDescription,
		imageUrl: repositoryAvatar,
		iconUrl,
		authorName: repositoryOwnerLabel,
		authorAvatarUrl: repositoryAvatar,
		chips: repositoryChips,
		metrics: [],
		stats: repositoryCardStats,
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
	const primaryGameVersion = gameVersions[0] ?? "";
	const primaryLoader = loaders[0] ?? "";
	const categoryChips = categories.map((category) => `#${category}`).slice(0, 2);
	const extraCategoryChip = categories.length > 2 ? `+${categories.length - 2}` : "";
	const modrinthChips = [
		primaryGameVersion ? `MC ${primaryGameVersion}` : "",
		primaryLoader ? `로더 ${primaryLoader}` : "",
		...categoryChips,
		extraCategoryChip,
	]
		.filter((chip) => chip.length > 0)
		.slice(0, 4);

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
		chips: modrinthChips,
		metrics: [
			formatMetric("⬇", asNumber(project?.downloads) ?? 0, "다운로드"),
			formatMetric("❤", asNumber(project?.followers) ?? 0, "좋아요"),
		],
		stats: {
			updatedAt: normalizeText(project?.updated),
			version: primaryGameVersion || undefined,
			platforms: gameVersions.slice(0, 10),
			environments: loaders.slice(0, 10),
		},
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
		},
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

export async function buildLinkPreview(parsedUrl: URL): Promise<LinkPreview> {
	const hostname = parsedUrl.hostname.replace(/^www\./, "").toLowerCase();
	if (hostname === "github.com") {
		return buildGitHubPreview(parsedUrl);
	}
	if (hostname === "modrinth.com") {
		return buildModrinthPreview(parsedUrl);
	}
	if (hostname === "curseforge.com" || hostname === "legacy.curseforge.com") {
		return buildCurseForgePreview(parsedUrl);
	}
	if (hostname === "dcinside.com" || hostname === "gall.dcinside.com" || hostname === "m.dcinside.com") {
		return buildDcinsidePreview(parsedUrl);
	}
	return buildGenericPreview(parsedUrl);
}
