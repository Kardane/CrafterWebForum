"use client";

import { Menu } from "lucide-react";

interface HeaderProps {
	onMenuClick: () => void;
}

/**
 * 헤더 컴포넌트 - 레거시 스타일
 * - 단순 텍스트 로고 "스티브 갤러리 개발 포럼 - Beta"
 * - 사용자 메뉴는 사이드바 푸터로 이동됨
 */
export default function Header({ onMenuClick }: HeaderProps) {
	const forumTitle = "스티브 갤러리 개발 포럼 Beta v0.3";

	return (
		<header className="h-header bg-bg-primary border-b border-bg-tertiary flex items-center px-4 sticky top-0 z-header">
			<div className="flex items-center gap-3">
				{/* 모바일 햄버거 메뉴 */}
				<button
					onClick={onMenuClick}
					className="p-1.5 text-text-muted hover:bg-bg-secondary hover:text-text-primary rounded-md md:hidden transition-colors"
					aria-label="메뉴 열기"
				>
					<Menu size={20} />
				</button>

				<div className="inline-flex items-center rounded-xl px-2.5 py-1.5 text-base font-semibold text-text-primary">
					<span className="max-w-[62vw] truncate md:max-w-[520px]">{forumTitle}</span>
				</div>
			</div>
		</header>
	);
}
