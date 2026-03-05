import type { LinkPreview } from "@/lib/link-preview/types";
import { assertSafeHttpUrl, isBlockedHostname, isBlockedIpAddress } from "@/lib/network-guard";
import { buildGitHubPreview } from "@/lib/link-preview/providers-github";

const HTTP_TIMEOUT_MS = 4_500;
const MAX_REDIRECT_HOPS = 5;
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

export function isBlockedLinkPreviewHost(hostname: string): boolean {
	const lower = hostname.toLowerCase().replace(/^\[|\]$/g, "");
	if (isBlockedHostname(lower)) {
		return true;
	}
	if (isIpv4Literal(lower) && isBlockedIpAddress(lower)) {
		return true;
	}
	if (lower.includes(":") && isBlockedIpAddress(lower)) {
		return true;
	}
	return false;
}

async function safeFetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
	try {
		let currentUrl = url;
		for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
			const parsed = new URL(currentUrl);
			await assertSafeHttpUrl(parsed);

			const response = await fetch(currentUrl, {
				...init,
				signal: controller.signal,
				redirect: "manual",
				next: { revalidate: 60 * 5 },
			});

			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get("location");
				if (!location) {
					return response;
				}
				if (hop === MAX_REDIRECT_HOPS) {
					throw new Error("redirect_hop_limit_exceeded");
				}
				currentUrl = new URL(location, parsed).toString();
				continue;
			}

			return response;
		}

		throw new Error("redirect_hop_limit_exceeded");
	} finally {
		clearTimeout(timeout);
	}
}

async function fetchWithTimeout(url: string): Promise<Response> {
	return safeFetchWithTimeout(url, {
		headers: REQUEST_HEADERS,
	});
}

async function fetchGitHubWithTimeout(url: string): Promise<Response> {
	const headers: Record<string, string> = {
		...REQUEST_HEADERS,
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	};
	const token = (process.env.GITHUB_TOKEN ?? "").trim();
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}
	return safeFetchWithTimeout(url, { headers });
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
		return buildGitHubPreview(parsedUrl, {
			toFavicon,
			fallbackPreview,
			fetchGitHubWithTimeout,
			asRecord,
			asNumber,
			asStringArray,
			normalizeText,
			clampText,
			formatMetric,
		});
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
