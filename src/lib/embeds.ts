/**
 * 외부 콘텐츠 임베드 처리 유틸리티
 * YouTube, GitHub, Modrinth 등 외부 링크를 임베드 카드로 변환
 */

export interface EmbedLink {
	url: string;
	type: 'youtube' | 'streamable' | 'github' | 'gitlab' | 'modrinth' | 'curseforge' | 'spigot' | 'other';
}

interface ProtectedHtmlResult {
	protectedHtml: string;
	restoreHtml: (html: string) => string;
}

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

/**
 * 이미 렌더링된 HTML 블록을 잠시 보호해 URL 정규식이 속성값을 다시 변환하지 않게 방지
 */
function protectRenderedHtml(html: string): ProtectedHtmlResult {
	const fragments: string[] = [];
	const protectedHtml = html.replace(
		/<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<a\b[\s\S]*?<\/a>|<img\b[^>]*>|<iframe[\s\S]*?<\/iframe>|<video[\s\S]*?<\/video>|<audio[\s\S]*?<\/audio>/gi,
		(fragment) => {
			fragments.push(fragment);
			return `__HTML_FRAGMENT_${fragments.length - 1}__`;
		}
	);

	return {
		protectedHtml,
		restoreHtml: (nextHtml: string) =>
			nextHtml.replace(/__HTML_FRAGMENT_(\d+)__/g, (match, index) => {
				const parsedIndex = Number(index);
				return fragments[parsedIndex] ?? "";
			}),
	};
}

/**
 * YouTube 임베드 HTML 생성
 */
export function createYouTubeEmbed(videoId: string): string {
	return `<div class="embed-container">
		<iframe 
			width="560" 
			height="315" 
			src="https://www.youtube.com/embed/${videoId}" 
			title="YouTube video player" 
			frameborder="0" 
			allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
			referrerpolicy="strict-origin-when-cross-origin" 
			allowfullscreen>
		</iframe>
	</div>`;
}

/**
 * Streamable 임베드 HTML 생성
 */
export function createStreamableEmbed(videoId: string): string {
	return `<div class="embed-container">
		<iframe 
			width="560" 
			height="315" 
			src="https://streamable.com/e/${videoId}" 
			frameborder="0" 
			allowfullscreen>
		</iframe>
	</div>`;
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

		const isLocalForumHost = ["localhost", "127.0.0.1", "mcbrass.kro.kr"].includes(hostname);
		const postMatch = parsed.pathname.match(/^\/posts\/(\d+)(?:\/|$)/);

		if (isLocalForumHost && postMatch) {
			const postId = postMatch[1];
			badge = "CrafterForum";
			title = `포스트 #${postId}`;
			subtitle = "내부 게시글 링크";
			extraAttributes = ` data-post-id="${escapeHtml(postId)}"`;
			chips.push(`ID ${postId}`, "조회 로딩", "추천 로딩", "댓글 로딩");
		} else if (hostname === "github.com") {
			badge = "GitHub";
			chips.push("카테고리: 코드");
			if (segments.length === 1) {
				title = `@${segments[0]}`;
				subtitle = "GitHub 프로필";
				chips.push("타입: 프로필");
			} else if (segments.length >= 2) {
				const [owner, repo, section, sectionId] = segments;
				title = `${owner}/${repo}`;
				subtitle = "GitHub 저장소";
				chips.push("타입: 저장소");
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
			title = segments.slice(0, 2).join("/") || hostname;
			subtitle = segments.length > 2 ? `/${segments.slice(2).join("/")}` : "프로젝트 링크";
			chips.push("카테고리: 코드", "타입: 프로젝트");
		} else if (hostname === "modrinth.com") {
			badge = "Modrinth";
			title = segments.slice(0, 2).join("/") || "Modrinth 링크";
			subtitle = segments.length > 2 ? `/${segments.slice(2).join("/")}` : "모드/플러그인";
			const category = segments[0] === "plugin" ? "플러그인" : segments[0] === "mod" ? "모드" : "리소스";
			chips.push(`카테고리: ${category}`, "다운로드 정보: 외부 확인");
		} else if (hostname === "curseforge.com") {
			badge = "CurseForge";
			title = segments.slice(0, 3).join("/") || "CurseForge 링크";
			subtitle = "프로젝트 페이지";
			chips.push("카테고리: CurseForge", "다운로드 정보: 외부 확인");
		} else if (hostname === "spigotmc.org") {
			badge = "Spigot";
			title = segments.find((segment) => segment !== "resources") ?? "리소스";
			subtitle = "Spigot 리소스";
			chips.push("카테고리: 플러그인", "다운로드 정보: 외부 확인");
		}

		return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="external-link-card"${extraAttributes}>
			<span class="external-link-card__badge">${escapeHtml(badge)}</span>
			<span class="external-link-card__title">${escapeHtml(title)}</span>
			<span class="external-link-card__subtitle">${escapeHtml(subtitle)}</span>
			${buildMetaChips(chips)}
		</a>`;
	} catch {
		return `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="link-text">${escapeHtml(safeUrl)}</a>`;
	}
}

/**
 * 텍스트에서 YouTube 링크를 추출하고 임베드로 변환
 */
export function processYouTubeEmbeds(html: string): string {
	const ytEmbeds: string[] = [];

	// youtube.com/watch?v=
	html = html.replace(
		/(?:https?:\/\/)(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})(?:&[^\s]*)?/g,
		(match, id) => {
			ytEmbeds.push(createYouTubeEmbed(id));
			return `__YT_EMBED_${ytEmbeds.length - 1}__`;
		}
	);

	// youtu.be/
	html = html.replace(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?[^\s]*)?/g, (match, id) => {
		ytEmbeds.push(createYouTubeEmbed(id));
		return `__YT_EMBED_${ytEmbeds.length - 1}__`;
	});

	// Streamable
	html = html.replace(/https?:\/\/streamable\.com\/([a-z0-9]+)(?=$|[\s<])/gi, (match, id) => {
		ytEmbeds.push(createStreamableEmbed(id));
		return `__YT_EMBED_${ytEmbeds.length - 1}__`;
	});

	// 복원
	html = html.replace(/__YT_EMBED_(\d+)__/g, (match, index) => ytEmbeds[parseInt(index)]);

	return html;
}

/**
 * 외부 링크를 카드 형태로 렌더링
 */
export function processExternalLinks(html: string): string {
	const externalLinks: string[] = [];

	html = html.replace(
		/https?:\/\/(?:www\.)?(github\.com|gitlab\.com|codeberg\.org|modrinth\.com|curseforge\.com|spigotmc\.org|localhost|127\.0\.0\.1|mcbrass\.kro\.kr)\/[^\s<"']+/gi,
		(match) => {
			const cleanUrl = match.trim().replace(/[.,]$/, "");
			externalLinks.push(cleanUrl);
			return `__EXT_LINK_${externalLinks.length - 1}__`;
		}
	);

	html = html.replace(/__EXT_LINK_(\d+)__/g, (match, index) => {
		const link = externalLinks[parseInt(index, 10)];
		return buildExternalCardByUrl(link);
	});

	return html;
}

/**
 * 업로드된 파일 링크 처리 (이미지, 비디오, 오디오)
 */
export function processUploadedFiles(html: string): string {
	html = html.replace(/((?:https?:\/\/[^\s]+)?\/uploads\/([^\s"']+))/gi, (match, fullUrl, filename) => {
		if (
			match.includes('__MD_LINK_') ||
			match.includes('__GH_LINK_') ||
			match.includes('\x1FCODE')
		)
			return match;

		const ext = filename.split('.').pop()?.toLowerCase().split('?')[0] || '';

		if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
			return `<div class="embed-container"><img src="${fullUrl}" alt="uploaded image"></div>`;
		}
		if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) {
			return `<div class="embed-container"><video src="${fullUrl}" controls></video></div>`;
		}
		if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
			return `<div class="embed-container"><audio src="${fullUrl}" controls></audio></div>`;
		}
		return `<a href="${fullUrl}" download class="file-download">📦 ${filename}</a>`;
	});

	return html;
}

/**
 * 일반 이미지 링크 자동 임베드
 */
export function processImageLinks(html: string): string {
	html = html.replace(/(^|[\s>(])(https?:\/\/[^\s<"']+)/gi, (match, prefix, url) => {
		if (
			url.includes('embed-container') ||
			url.includes('iframe') ||
			url.includes('<img') ||
			url.includes('<video') ||
			url.includes('<audio') ||
			url.includes('file-download') ||
			url.includes('/uploads/') ||
			url.includes('__MD_LINK_') ||
			url.includes('__GH_LINK_') ||
			url.includes('\x1FCODE') ||
			url.includes('__YT_EMBED_')
		)
			return `${prefix}${url}`;

		if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) {
			return `${prefix}<div class="embed-container"><img src="${url}" alt="image" loading="lazy"></div>`;
		}
		return `${prefix}<a href="${url}" target="_blank" class="link-text">${url}</a>`;
	});

	return html;
}

/**
 * 모든 임베드 처리를 통합 실행
 */
export function processAllEmbeds(html: string): string {
	const { protectedHtml, restoreHtml } = protectRenderedHtml(html);
	let nextHtml = protectedHtml;
	nextHtml = processYouTubeEmbeds(nextHtml);
	nextHtml = processExternalLinks(nextHtml);
	nextHtml = processUploadedFiles(nextHtml);
	nextHtml = processImageLinks(nextHtml);
	return restoreHtml(nextHtml);
}
