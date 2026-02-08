/**
 * 사이드바 설정 유틸리티
 * - localStorage 관리
 * - 기본값 정의
 */

import { SidebarLink } from "./sidebar-links";

export interface SidebarSettings {
	order: string[];
	hidden: string[];
	deleted?: string[]; // 삭제된 기본 링크 ID 목록
	gridItems: string[];
	customLinks: SidebarLink[];
}

const STORAGE_KEY = "sidebarSettings";
const UNSAFE_PROTOCOLS = new Set(["javascript:", "data:", "vbscript:", "file:"]);

/**
 * 기본 설정값
 */
export const DEFAULT_SETTINGS: SidebarSettings = {
	order: [],
	hidden: [],
	deleted: [],
	gridItems: [],
	customLinks: []
};

/**
 * 사이드바 링크 URL 정규화
 * - 내부 링크는 `/`로 시작해야 함
 * - 외부 링크는 http/https만 허용
 */
export function normalizeSidebarUrl(rawUrl: string): string | null {
	const trimmed = rawUrl.trim();
	if (!trimmed) {
		return null;
	}

	if (trimmed.startsWith("/")) {
		return trimmed;
	}

	const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

	try {
		const parsed = new URL(candidate);
		if (UNSAFE_PROTOCOLS.has(parsed.protocol)) {
			return null;
		}
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			return null;
		}
		return parsed.toString();
	} catch {
		return null;
	}
}

/**
 * 설정 불러오기
 */
export function getSidebarSettings(): SidebarSettings {
	if (typeof window === "undefined") {
		return DEFAULT_SETTINGS;
	}

	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
		}
	} catch (e) {
		console.error("Failed to load sidebar settings", e);
	}

	return DEFAULT_SETTINGS;
}

/**
 * 설정 저장
 */
export function saveSidebarSettings(settings: SidebarSettings): void {
	if (typeof window === "undefined") return;

	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	} catch (e) {
		console.error("Failed to save sidebar settings", e);
	}
}

/**
 * 설정 초기화
 */
export function resetSidebarSettings(): void {
	if (typeof window === "undefined") return;

	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch (e) {
		console.error("Failed to reset sidebar settings", e);
	}
}

/**
 * 커스텀 링크 추가
 */
export function addCustomLink(link: Omit<SidebarLink, "id" | "isCustom">): SidebarLink {
	const settings = getSidebarSettings();
	const newLink: SidebarLink = {
		...link,
		id: `custom_${Date.now()}`,
		isCustom: true
	};

	settings.customLinks.push(newLink);
	saveSidebarSettings(settings);

	return newLink;
}

/**
 * 커스텀 링크 삭제
 */
export function removeCustomLink(linkId: string): void {
	const settings = getSidebarSettings();

	settings.customLinks = settings.customLinks.filter((l) => l.id !== linkId);
	settings.order = settings.order.filter((id) => id !== linkId);
	settings.hidden = settings.hidden.filter((id) => id !== linkId);
	settings.gridItems = settings.gridItems.filter((id) => id !== linkId);

	saveSidebarSettings(settings);
}

/**
 * 링크 순서 업데이트
 */
export function updateLinkOrder(order: string[]): void {
	const settings = getSidebarSettings();
	settings.order = order;
	saveSidebarSettings(settings);
}

/**
 * 링크 숨기기/표시 토글
 */
export function toggleLinkVisibility(linkId: string): void {
	const settings = getSidebarSettings();

	if (settings.hidden.includes(linkId)) {
		settings.hidden = settings.hidden.filter((id) => id !== linkId);
	} else {
		settings.hidden.push(linkId);
	}

	saveSidebarSettings(settings);
}

/**
 * Favicon URL 생성
 */
export function getFaviconUrl(url: string): string {
	const normalized = normalizeSidebarUrl(url);
	if (!normalized || normalized.startsWith("/")) {
		return "";
	}

	try {
		const domain = new URL(normalized).hostname;
		return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
	} catch {
		return "";
	}
}
