"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface HeaderProps {
	onMenuClick: () => void;
}

/**
 * 헤더 컴포넌트 - 레거시 스타일
 * - 단순 텍스트 로고 "스티브 갤러리 개발 포럼 - Beta"
 * - 사용자 메뉴는 사이드바 푸터로 이동됨
 */
export default function Header({ onMenuClick }: HeaderProps) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);
	const pathname = usePathname();
	const queryBoardIsOmbudsman =
		typeof window !== "undefined"
			? new URLSearchParams(window.location.search).get("board") === "ombudsman"
			: false;
	const isOmbudsmanState = pathname.startsWith("/ombudsman") || queryBoardIsOmbudsman;
	const forumTitle = "스티브 갤러리 개발 포럼 Beta v0.2";
	const ombudsmanTitle = "스티브 갤러리 서버 신문고 Beta v0.1";
	const menuItems = isOmbudsmanState
		? [{ href: "/", label: forumTitle }]
		: [{ href: "/ombudsman", label: ombudsmanTitle }];

	useEffect(() => {
		const onPointerDown = (event: MouseEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) {
				return;
			}
			if (!menuRef.current?.contains(target)) {
				setIsMenuOpen(false);
			}
		};
		window.addEventListener("mousedown", onPointerDown);
		return () => {
			window.removeEventListener("mousedown", onPointerDown);
		};
	}, []);

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

				<div className="relative" ref={menuRef}>
					<button
						type="button"
						onClick={() => setIsMenuOpen((prev) => !prev)}
						className="group inline-flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-base font-semibold text-text-primary transition-all hover:bg-bg-secondary/80 hover:shadow-sm"
						aria-haspopup="menu"
						aria-expanded={isMenuOpen}
					>
						<span className="max-w-[62vw] truncate md:max-w-[520px]">
							{isOmbudsmanState ? ombudsmanTitle : forumTitle}
						</span>
						<span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-bg-tertiary/70 text-text-muted transition-transform group-hover:text-text-secondary">
							<ChevronDown size={16} className={isMenuOpen ? "rotate-180 transition-transform" : "transition-transform"} />
						</span>
					</button>
					{isMenuOpen && (
						<div className="absolute left-0 top-full mt-2 min-w-[260px] rounded-xl border border-border/80 bg-bg-secondary/95 p-1.5 shadow-xl backdrop-blur">
							{menuItems.map((item) => (
								<Link
									key={item.href}
									href={item.href}
									className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
									onClick={() => setIsMenuOpen(false)}
								>
									<span className="min-w-0 flex-1 truncate">{item.label}</span>
									<span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-bg-primary/35 text-text-muted">
										<ChevronDown size={16} className="-rotate-90" />
									</span>
								</Link>
							))}
						</div>
					)}
				</div>
			</div>
		</header>
	);
}
