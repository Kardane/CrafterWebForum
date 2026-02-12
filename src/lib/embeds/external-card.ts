/**
 * 외부 링크를 카드 형태로 렌더링
 * GitHub, GitLab, Modrinth, CurseForge, Spigot, Minecraft Wiki 등
 */
import { textOr } from "@/lib/system-text";

export interface EmbedLink {
	url: string;
	type: 'youtube' | 'streamable' | 'github' | 'gitlab' | 'modrinth' | 'curseforge' | 'spigot' | 'other';
}

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

// 메타 칩 HTML 생성
function buildMetaChips(chips: string[]): string {
	if (chips.length === 0) {
		return "";
	}

	const chipHtml = chips
		.map((chip) => `<span class="external-link-card__meta-chip">${escapeHtml(chip)}</span>`)
		.join("");
	return `<div class="external-link-card__meta">${chipHtml}</div>`;
}

// 파비콘 URL 생성
function getFaviconUrl(hostname: string): string {
	return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=64`;
}

// URL 기반 외부 카드 HTML 빌드
function buildExternalCardByUrl(rawUrl: string): string {
	const safeUrl = rawUrl.trim();

	try {
		const parsed = new URL(safeUrl);
		const hostname = parsed.hostname.replace(/^www\./, "");
		const segments = parsed.pathname.split("/").filter(Boolean);

		let badge = hostname;
		let title = hostname;
		let subtitle = parsed.pathname === "/" ? safeUrl : parsed.pathname;
		let extraAttributes = "";
		const chips: string[] = [];
		let iconUrl = getFaviconUrl(hostname);

		const isLocalForumHost = ["localhost", "127.0.0.1", "mcbrass.kro.kr"].includes(hostname);
		const postMatch = parsed.pathname.match(/^\/posts\/(\d+)(?:\/|$)/);

		if (isLocalForumHost && postMatch) {
			const postId = postMatch[1];
			badge = "CrafterForum";
			title = `포스트 #${postId}`;
			subtitle = textOr("externalCard.internalPost", "내부 게시글 링크");
			extraAttributes = ` data-post-id="${escapeHtml(postId)}"`;
			iconUrl = "/img/Crafter.png";
			chips.push(
				`ID ${postId}`,
				textOr("externalCard.loadingViews", "조회 로딩"),
				textOr("externalCard.loadingLikes", "추천 로딩"),
				textOr("externalCard.loadingComments", "댓글 로딩")
			);
		} else if (hostname === "github.com") {
			badge = "GitHub";
			iconUrl = "https://www.google.com/s2/favicons?domain=github.com&sz=64";
			chips.push(textOr("externalCard.categoryCode", "카테고리: 코드"));
			if (segments.length === 1) {
				title = `@${segments[0]}`;
				subtitle = "GitHub 프로필";
				chips.push(textOr("externalCard.typeProfile", "타입: 프로필"));
			} else if (segments.length >= 2) {
				const [owner, repo, section, sectionId] = segments;
				title = `${owner}/${repo}`;
				subtitle = "GitHub 저장소";
				chips.push(textOr("externalCard.typeRepository", "타입: 저장소"));
				if (section === "issues" && sectionId) {
					subtitle = `Issue #${sectionId}`;
					chips.push(`이슈 ${sectionId}`);
				} else if (section === "pull" && sectionId) {
					subtitle = `Pull Request #${sectionId}`;
					chips.push(`PR ${sectionId}`);
				} else if (section === "releases") {
					subtitle = "릴리스";
					chips.push("릴리스");
				}
			}
		} else if (hostname === "gitlab.com" || hostname === "codeberg.org") {
			badge = hostname === "gitlab.com" ? "GitLab" : "Codeberg";
			iconUrl = getFaviconUrl(hostname);
			title = segments.slice(0, 2).join("/") || hostname;
			subtitle = segments.length > 2 ? `/${segments.slice(2).join("/")}` : "프로젝트 링크";
			chips.push(
				textOr("externalCard.categoryCode", "카테고리: 코드"),
				textOr("externalCard.typeProject", "타입: 프로젝트")
			);
		} else if (hostname === "modrinth.com") {
			badge = "Modrinth";
			iconUrl = "https://www.google.com/s2/favicons?domain=modrinth.com&sz=64";
			title = segments.slice(0, 2).join("/") || "Modrinth 링크";
			subtitle = segments.length > 2 ? `/${segments.slice(2).join("/")}` : "모드/플러그인";
			if (segments[0] === "plugin") {
				chips.push(textOr("externalCard.typePlugin", "타입: 플러그인"));
			} else if (segments[0] === "mod") {
				chips.push(textOr("externalCard.typeMod", "타입: 모드"));
			} else {
				chips.push("타입: 리소스");
			}
			chips.push(textOr("externalCard.downloadsExternal", "다운로드 정보: 외부 확인"));
		} else if (hostname === "curseforge.com") {
			badge = "CurseForge";
			iconUrl = "https://www.google.com/s2/favicons?domain=curseforge.com&sz=64";
			title = segments.slice(0, 3).join("/") || "CurseForge 링크";
			subtitle = "프로젝트 페이지";
			chips.push("카테고리: CurseForge", textOr("externalCard.downloadsExternal", "다운로드 정보: 외부 확인"));
		} else if (hostname === "spigotmc.org") {
			badge = "Spigot";
			iconUrl = "https://www.google.com/s2/favicons?domain=spigotmc.org&sz=64";
			title = segments.find((segment) => segment !== "resources") ?? "리소스";
			subtitle = "Spigot 리소스";
			chips.push(
				textOr("externalCard.typePlugin", "타입: 플러그인"),
				textOr("externalCard.downloadsExternal", "다운로드 정보: 외부 확인")
			);
		} else if (hostname === "minecraft.wiki") {
			badge = "Minecraft Wiki";
			iconUrl = "https://www.google.com/s2/favicons?domain=minecraft.wiki&sz=64";
			title = decodeURIComponent(segments.join(" / ") || "Minecraft Wiki");
			subtitle = "문서 링크";
			chips.push(
				textOr("externalCard.typeWiki", "타입: 위키"),
				textOr("externalCard.typeDocument", "타입: 문서")
			);
		}

		return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="external-link-card"${extraAttributes}>
			<span class="external-link-card__icon-wrap">
				<img src="${escapeHtml(iconUrl)}" alt="${escapeHtml(badge)} icon" class="external-link-card__icon" loading="lazy">
			</span>
			<span class="external-link-card__body">
				<span class="external-link-card__badge">${escapeHtml(badge)}</span>
				<span class="external-link-card__title">${escapeHtml(title)}</span>
				<span class="external-link-card__subtitle">${escapeHtml(subtitle)}</span>
				${buildMetaChips(chips)}
			</span>
		</a>`;
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
		/https?:\/\/(?:www\.)?(github\.com|gitlab\.com|codeberg\.org|modrinth\.com|curseforge\.com|spigotmc\.org|minecraft\.wiki|localhost|127\.0\.0\.1|mcbrass\.kro\.kr)\/[^\s<"']+/gi,
		(match) => {
			const cleanUrl = match.trim().replace(/[.,]$/, "");
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
