/**
 * 마크다운 파서 유틸리티
 * 기존 post-markdown.js의 processContent 로직을 TypeScript로 이식
 */

/**
 * HTML 이스케이프 (XSS 방지)
 */
export function escapeHtml(text: string): string {
	const map: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#039;',
	};
	return text.replace(/[&<>"']/g, (m) => map[m]);
}

function isSafeMarkdownUrl(rawUrl: string): boolean {
	const trimmed = rawUrl.trim();
	if (!trimmed) {
		return false;
	}
	if (trimmed.startsWith("/")) {
		return true;
	}
	if (trimmed.startsWith("#")) {
		return true;
	}
	try {
		const parsed = new URL(trimmed);
		return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:";
	} catch {
		return false;
	}
}

function normalizeMarkdownLineBreaks(html: string): string {
	// 블록 요소 경계에 남는 불필요한 <br> 제거
	let normalized = html
		.replace(/<br>\s*(<\/(?:h[1-6]|ul|ol|blockquote|pre)>)/gi, "$1")
		.replace(/(<(?:h[1-6]|ul|ol|blockquote|pre)\b[^>]*>)\s*<br>/gi, "$1")
		.replace(/<br>\s*(<img\b[^>]*class="[^"]*\bmd-image\b[^"]*"[^>]*>)/gi, "$1")
		.replace(/(<img\b[^>]*class="[^"]*\bmd-image\b[^"]*"[^>]*>)\s*<br>/gi, "$1")
		.replace(/<br>\s*(<hr class="md-hr">)/gi, "$1")
		.replace(/(<hr class="md-hr">)\s*<br>/gi, "$1");

	normalized = normalized.replace(
		/(<\/(?:h[1-6]|ul|ol|blockquote|pre)>)\s*(?:<br>\s*)+(?=<(?:h[1-6]|ul|ol|blockquote|pre|hr)\b)/gi,
		"$1"
	);

	// 연속 개행은 최대 2줄까지만 유지
	return normalized.replace(/(?:<br>\s*){3,}/gi, "<br><br>");
}

function limitCodePreviewLines(code: string, maxLines = 20): string {
	const lines = code.split(/\r?\n/);
	if (lines.length <= maxLines) {
		return code;
	}
	return `${lines.slice(0, maxLines).join("\n")}\n...`;
}

/**
 * 마크다운 텍스트를 HTML로 변환
 * @param text 원본 마크다운 텍스트
 * @returns 변환된 HTML 문자열
 */
export function processMarkdown(text: string): string {
	if (!text) return '';

	// 1. 코드 블록 추출 (먼저 처리하여 내부 마크다운 문법 무시)
	const codeBlocks: Array<{ lang: string; code: string }> = [];
	let html = text.replace(/```(\w*)\r?\n?([\s\S]*?)```/g, (match, lang, code) => {
		codeBlocks.push({ lang: lang || 'plaintext', code: code.trim() });
		return `\x1FCODE${codeBlocks.length - 1}CODE\x1F`;
	});

	// HTML 이스케이프 (코드 블록 제외)
	html = escapeHtml(html);

	// 2. 마크다운 문법 처리
	// 2.1 수평선
	html = html.replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '<hr class="md-hr">');

	// 2.2 헤더 (h6 → h1 순서로 처리하여 중복 매칭 방지)
	html = html.replace(/^######\s+(.+)$/gm, '<h6 class="md-header">$1</h6>');
	html = html.replace(/^#####\s+(.+)$/gm, '<h5 class="md-header">$1</h5>');
	html = html.replace(/^####\s+(.+)$/gm, '<h4 class="md-header">$1</h4>');
	html = html.replace(/^###\s+(.+)$/gm, '<h3 class="md-header">$1</h3>');
	html = html.replace(/^##\s+(.+)$/gm, '<h2 class="md-header">$1</h2>');
	html = html.replace(/^#\s+(.+)$/gm, '<h1 class="md-header">$1</h1>');

	// 2.3 인용문
	html = html.replace(/^&gt;\s?(.*)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');
	html = html.replace(/<\/blockquote>\n<blockquote class="md-blockquote">/g, '\n');

	// 2.4 순서 없는 목록
	html = html.replace(/^[-*+]\s+(.+)$/gm, '<li class="md-ul-item">$1</li>');
	html = html.replace(/(<li class="md-ul-item">[\s\S]*?<\/li>)(?:\n(?=<li class="md-ul-item">))?/g, '$1');
	html = html.replace(/(<li class="md-ul-item">.*<\/li>(\n<li class="md-ul-item">.*<\/li>)*)/g, '<ul class="md-ul">$1</ul>');

	// 2.5 순서 있는 목록
	html = html.replace(/(?:^\d+\.\s+.*(?:\n\d+\.\s+.*)*)/gm, (match) => {
		const items = match.split('\n');
		const firstMatch = items[0].match(/^(\d+)\./);
		const startNum = firstMatch ? firstMatch[1] : '1';

		const lis = items
			.map((line) => {
				const content = line.replace(/^\d+\.\s+/, '');
				return `<li class="md-ol-item">${content}</li>`;
			})
			.join('');

		const startAttr = startNum !== '1' ? ` start="${startNum}"` : '';
		return `<ol class="md-ol"${startAttr}>${lis}</ol>`;
	});

	// 2.6 인라인 코드
	html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

	// 2.7 굵게
	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');

	// 2.8 이탤릭
	html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
	html = html.replace(/(?<!_)_([^_]+)_(?!_)/g, '<em>$1</em>');

	// 2.9 취소선
	html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

	// 3. 마크다운 이미지/링크 추출
	const mdLinks: string[] = [];
	html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
		if (!isSafeMarkdownUrl(url)) {
			mdLinks.push(alt);
			return `__MD_LINK_${mdLinks.length - 1}__`;
		}
		const safeUrl = url.trim();
		const safeAlt = alt;
		const imgTag = `<img src="${safeUrl}" alt="${safeAlt}" class="md-image" loading="lazy" data-lightbox="image">`;
		mdLinks.push(imgTag);
		return `__MD_LINK_${mdLinks.length - 1}__`;
	});

	html = html.replace(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
		if (!isSafeMarkdownUrl(url)) {
			mdLinks.push(text);
			return `__MD_LINK_${mdLinks.length - 1}__`;
		}
		const safeText = text;
		const safeUrl = url.trim();
		let replacement: string;
		if (url.includes('/uploads/')) {
			const icon = text.includes('📦') ? '' : '📦 ';
			replacement = `<a href="${safeUrl}" download class="file-download">${icon}${safeText}</a>`;
		} else {
			replacement = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="link-text">${safeText}</a>`;
		}
		mdLinks.push(replacement);
		return `__MD_LINK_${mdLinks.length - 1}__`;
	});

	// 4. 코드 블록 복원
	html = html.replace(/\x1FCODE(\d+)CODE\x1F/g, (match, index) => {
		const block = codeBlocks[parseInt(index)];
		const limitedCode = limitCodePreviewLines(block.code, 20);
		return `<pre><code class="language-${block.lang}">${escapeHtml(limitedCode)}</code></pre>`;
	});

	// 5. 마크다운 링크 복원
	html = html.replace(/__MD_LINK_(\d+)__/g, (match, index) => {
		return mdLinks[parseInt(index)];
	});

	// 6. 줄바꿈 처리 (연속된 2개 이상의 \n을 <br>로 변환)
	html = html.replace(/\n\n+/g, '<br><br>');
	html = html.replace(/\n/g, '<br>');
	html = normalizeMarkdownLineBreaks(html);

	return html;
}
