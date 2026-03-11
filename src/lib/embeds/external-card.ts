/**
 * 외부 링크를 카드 형태로 렌더링
 * GitHub, Modrinth, DCinside, 내부 포스트 링크를 우선 지원
 */

import { textOr } from "@/lib/system-text";

export interface EmbedLink {
	url: string;
	type: "youtube" | "streamable" | "github" | "gitlab" | "modrinth" | "curseforge" | "spigot" | "other";
}

const INTERNAL_FORUM_HOSTS = new Set(["localhost", "127.0.0.1", "mcbrass.kro.kr"]);

const DOMAIN_ICON_OVERRIDES: Record<string, string> = {
	"github.com": "https://www.google.com/s2/favicons?domain=github.com&sz=64",
	"modrinth.com": "https://www.google.com/s2/favicons?domain=modrinth.com&sz=64",
	"dcinside.com": "https://www.google.com/s2/favicons?domain=dcinside.com&sz=64",
	"gall.dcinside.com": "https://www.google.com/s2/favicons?domain=dcinside.com&sz=64",
	"m.dcinside.com": "https://www.google.com/s2/favicons?domain=dcinside.com&sz=64",
	"curseforge.com": "https://www.google.com/s2/favicons?domain=curseforge.com&sz=64",
	"legacy.curseforge.com": "https://www.google.com/s2/favicons?domain=curseforge.com&sz=64",
};

/**
 * HTML 특수 문자 이스케이프
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

function getFaviconUrl(hostname: string): string {
	return DOMAIN_ICON_OVERRIDES[hostname] ?? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
}

function safeDecodeURIComponent(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

function buildMetaChips(chips: string[]): string {
	if (chips.length === 0) {
		return "";
	}
	const chipHtml = chips
		.map((chip) => `<span class="external-link-card__meta-chip">${escapeHtml(chip)}</span>`)
		.join("");
	return `<div class="external-link-card__meta">${chipHtml}</div>`;
}

function createCardHtml(params: {
	url: string;
	badge: string;
	title: string;
	subtitle: string;
	iconUrl: string;
	chips: string[];
	extraAttributes?: string;
	className?: string;
}): string {
	const { url, badge, title, subtitle, iconUrl, chips, extraAttributes = "", className = "" } = params;
	const classes = ["external-link-card", className].filter(Boolean).join(" ");
	return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="${classes}"${extraAttributes}>
		<span class="external-link-card__media">
			<img src="${escapeHtml(iconUrl)}" alt="${escapeHtml(badge)} 썸네일" class="external-link-card__thumb" loading="lazy" decoding="async">
			<img src="${escapeHtml(iconUrl)}" alt="" aria-hidden="true" class="external-link-card__icon" loading="lazy" decoding="async">
		</span>
		<span class="external-link-card__body">
			<span class="external-link-card__badge">${escapeHtml(badge)}</span>
			<span class="external-link-card__title">${escapeHtml(title)}</span>
			<span class="external-link-card__subtitle">${escapeHtml(subtitle)}</span>
			${buildMetaChips(chips)}
		</span>
	</a>`;
}

/**
 * URL 기반 외부 카드 HTML 빌드
 * - 지원하지 않는 URL이면 일반 링크로 fallback
 */
export function buildExternalCardByUrl(rawUrl: string): string {
	const safeUrl = rawUrl.trim();
	try {
		const parsed = new URL(safeUrl);
		const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
		const segments = parsed.pathname.split("/").filter(Boolean);

		let badge = hostname;
		let title = hostname;
		let subtitle = parsed.pathname === "/" ? safeUrl : parsed.pathname;
		let iconUrl = getFaviconUrl(hostname);
		const chips: string[] = [];
		let extraAttributes = "";

		const postMatch = parsed.pathname.match(/^\/posts\/(\d+)(?:\/|$)/);
		if (INTERNAL_FORUM_HOSTS.has(hostname) && postMatch) {
			const postId = postMatch[1];
			badge = "CrafterForum";
			title = `포스트 #${postId}`;
			subtitle = textOr("externalCard.internalPost", "내부 게시글 링크");
			iconUrl = "/img/Crafter.png";
			extraAttributes = ` data-post-id="${escapeHtml(postId)}"`;
			chips.push(
				`ID ${postId}`,
				textOr("externalCard.loadingViews", "조회 로딩"),
				textOr("externalCard.loadingLikes", "추천 로딩"),
				textOr("externalCard.loadingComments", "댓글 로딩")
			);
			return createCardHtml({
				url: safeUrl,
				badge,
				title,
				subtitle,
				iconUrl,
				chips,
				extraAttributes,
			});
		}

		if (hostname === "github.com") {
			badge = "GitHub";
			if (segments.length === 1) {
				title = `@${segments[0]}`;
				subtitle = "GitHub 프로필";
				chips.push(textOr("externalCard.typeProfile", "타입: 프로필"));
				extraAttributes = ` data-preview-url="${escapeHtml(safeUrl)}" data-preview-provider="github" data-preview-kind="profile"`;
			} else if (segments.length >= 2) {
				const [owner, repo, section, sectionId] = segments;
				title = `${owner}/${repo}`;
				subtitle = "GitHub 저장소";
				chips.push(textOr("externalCard.typeRepository", "타입: 저장소"));
				let kind = "repository";

				if (section === "issues" && sectionId) {
					kind = "issue";
					subtitle = `Issue #${sectionId}`;
				} else if ((section === "pull" || section === "pulls") && sectionId) {
					kind = "pull_request";
					subtitle = `Pull Request #${sectionId}`;
				} else if (section === "wiki") {
					kind = "wiki";
					const pageTitle = segments.slice(3).join("/") || "Home";
					subtitle = `Wiki / ${safeDecodeURIComponent(pageTitle)}`;
				} else if (section === "releases") {
					kind = "release";
					subtitle = "릴리스";
				}
				extraAttributes = ` data-preview-url="${escapeHtml(safeUrl)}" data-preview-provider="github" data-preview-kind="${kind}"`;
			} else {
				return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="link-text">${escapeHtml(safeUrl)}</a>`;
			}

			return createCardHtml({
				url: safeUrl,
				badge,
				title,
				subtitle,
				iconUrl,
				chips,
				extraAttributes,
				className: "external-link-card--github",
			});
		}

		if (hostname === "modrinth.com") {
			badge = "Modrinth";
			if (segments.length > 0) {
				title = segments.slice(0, 2).join("/") || "Modrinth 링크";
				subtitle = segments.length > 2 ? `/${segments.slice(2).join("/")}` : "모드/플러그인";
			}
			const routeType = segments[0] ?? "project";
			const kind = routeType === "mod" || routeType === "plugin" || routeType === "modpack" ? "project" : "other";
			chips.push(
				routeType === "plugin"
					? textOr("externalCard.typePlugin", "타입: 플러그인")
					: routeType === "mod"
						? textOr("externalCard.typeMod", "타입: 모드")
						: "타입: 프로젝트"
			);
			extraAttributes = ` data-preview-url="${escapeHtml(safeUrl)}" data-preview-provider="modrinth" data-preview-kind="${kind}"`;
			return createCardHtml({
				url: safeUrl,
				badge,
				title,
				subtitle,
				iconUrl,
				chips,
				extraAttributes,
			});
		}

		if (hostname === "dcinside.com" || hostname === "gall.dcinside.com" || hostname === "m.dcinside.com") {
			badge = "DCinside";
			title = "디시인사이드 링크";
			subtitle = segments.length > 0 ? `/${segments.join("/")}` : "게시글 링크";
			chips.push("타입: 게시글");
			extraAttributes = ` data-preview-url="${escapeHtml(safeUrl)}" data-preview-provider="dcinside" data-preview-kind="article"`;
			return createCardHtml({
				url: safeUrl,
				badge,
				title,
				subtitle,
				iconUrl,
				chips,
				extraAttributes,
			});
		}

		if (hostname === "gitlab.com" || hostname === "codeberg.org") {
			badge = hostname === "gitlab.com" ? "GitLab" : "Codeberg";
			title = segments.slice(0, 2).join("/") || hostname;
			subtitle = segments.length > 2 ? `/${segments.slice(2).join("/")}` : "프로젝트 링크";
			chips.push(
				textOr("externalCard.categoryCode", "카테고리: 코드"),
				textOr("externalCard.typeProject", "타입: 프로젝트")
			);
			return createCardHtml({
				url: safeUrl,
				badge,
				title,
				subtitle,
				iconUrl,
				chips,
			});
		}

		if (hostname === "curseforge.com" || hostname === "legacy.curseforge.com") {
			badge = "CurseForge";
			title = segments.slice(0, 3).join("/") || "CurseForge 링크";
			subtitle = "전환 중...";
			chips.push("카테고리: CurseForge");
			extraAttributes = ` data-preview-url="${escapeHtml(safeUrl)}" data-preview-provider="curseforge" data-preview-kind="project"`;
			return createCardHtml({
				url: safeUrl,
				badge,
				title,
				subtitle,
				iconUrl,
				chips,
				extraAttributes,
			});
		}

		if (hostname === "spigotmc.org") {
			badge = "Spigot";
			title = segments.find((segment) => segment !== "resources") ?? "리소스";
			subtitle = "Spigot 리소스";
			chips.push(textOr("externalCard.typePlugin", "타입: 플러그인"));
			return createCardHtml({
				url: safeUrl,
				badge,
				title,
				subtitle,
				iconUrl,
				chips,
			});
		}

		if (hostname === "minecraft.wiki") {
			badge = "Minecraft Wiki";
			title = safeDecodeURIComponent(segments.join(" / ") || "Minecraft Wiki");
			subtitle = "문서 링크";
			chips.push(
				textOr("externalCard.typeWiki", "타입: 위키"),
				textOr("externalCard.typeDocument", "타입: 문서")
			);
			return createCardHtml({
				url: safeUrl,
				badge,
				title,
				subtitle,
				iconUrl,
				chips,
			});
		}

		return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="link-text">${escapeHtml(safeUrl)}</a>`;
	} catch {
		return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="link-text">${escapeHtml(safeUrl)}</a>`;
	}
}

/**
 * 외부 링크를 카드 형태로 렌더링
 */
export function processExternalLinks(html: string): string {
	const externalLinks: string[] = [];

	html = html.replace(
		/https?:\/\/(?:www\.)?(github\.com|gitlab\.com|codeberg\.org|modrinth\.com|curseforge\.com|spigotmc\.org|minecraft\.wiki|dcinside\.com|gall\.dcinside\.com|m\.dcinside\.com|localhost|127\.0\.0\.1|mcbrass\.kro\.kr)\/[^\s<"']+/gi,
		(match) => {
			const cleanUrl = match.trim().replace(/[\])}>.,]+$/, "");
			externalLinks.push(cleanUrl);
			return `__EXT_LINK_${externalLinks.length - 1}__`;
		}
	);

	html = html.replace(/__EXT_LINK_(\d+)__/g, (_match, index) => {
		const link = externalLinks[parseInt(index, 10)];
		return buildExternalCardByUrl(link);
	});

	return html;
}
