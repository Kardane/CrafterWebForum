"use client";

import { useState, useEffect, DragEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
	LayoutGrid,
	MessageSquare,
	Settings,
	ExternalLink,
	GripVertical,
	LogOut
} from "lucide-react";
import classNames from "classnames";

interface SidebarProps {
	isOpen: boolean;
	onClose: () => void;
}

interface SidebarLink {
	id: string;
	title: string;
	url: string;
	icon?: string;
	isCustom?: boolean;
}

// 기본 링크 데이터
const DEFAULT_LINKS: SidebarLink[] = [
	{ id: "home", title: "홈", url: "/" },
	{ id: "notice", title: "공지사항", url: "/board/notice" },
	{ id: "free", title: "자유게시판", url: "/board/free" },
	{ id: "questions", title: "질문 & 답변", url: "/board/questions" },
	{ id: "tips", title: "팁 & 노하우", url: "/board/tips" },
];

/**
 * 마인크래프트 헤드 이미지 URL 생성
 */
function getMinecraftHeadUrl(uuid: string | null | undefined, size = 32): string | null {
	if (!uuid) return null;
	return `https://api.mineatar.io/face/${uuid}?scale=${size}`;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
	const pathname = usePathname();
	const router = useRouter();
	const { data: session } = useSession();
	const [links, setLinks] = useState<SidebarLink[]>(DEFAULT_LINKS);
	const [draggedItem, setDraggedItem] = useState<SidebarLink | null>(null);

	// 로컬 스토리지에서 커스텀 설정 로드 (Hydration Mismatch 방지 위해 useEffect 사용)
	useEffect(() => {
		const savedSettings = localStorage.getItem("sidebarSettings");
		if (savedSettings) {
			try {
				const parsed = JSON.parse(savedSettings);
				// TODO: 저장된 순서 및 커스텀 링크 병합 로직 구현 필요
				// 현재는 기본 링크만 표시
			} catch (e) {
				console.error("Failed to load sidebar settings", e);
			}
		}
	}, []);

	// Drag & Drop Handlers
	const handleDragStart = (e: DragEvent<HTMLAnchorElement>, item: SidebarLink) => {
		setDraggedItem(item);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragOver = (e: DragEvent<HTMLAnchorElement>, index: number) => {
		e.preventDefault();
		if (!draggedItem) return;

		const draggedIndex = links.indexOf(draggedItem);
		if (draggedIndex === index) return;

		const newLinks = [...links];
		newLinks.splice(draggedIndex, 1);
		newLinks.splice(index, 0, draggedItem);

		setLinks(newLinks);
	};

	const handleDragEnd = () => {
		setDraggedItem(null);
		// TODO: 변경된 순서 저장 로직
		// localStorage.setItem("sidebarSettings", JSON.stringify({ order: links.map(l => l.id) }));
	};

	// 사용자 역할 텍스트 변환
	const getRoleText = (role: string | undefined) => {
		if (role === "admin") return "관리자";
		return "사용자";
	};

	return (
		<>
			{/* 모바일 오버레이 */}
			<div
				className={classNames(
					"fixed inset-0 bg-black/50 z-[90] transition-opacity md:hidden",
					isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
				)}
				onClick={onClose}
			/>

			{/* 사이드바 본문 */}
			<aside
				className={classNames(
					"fixed top-header left-0 bottom-0 w-sidebar bg-bg-secondary border-r border-bg-tertiary z-sidebar transition-transform duration-300 transform flex flex-col",
					isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
				)}
			>
				{/* 네비게이션 링크 영역 */}
				<nav className="flex-1 overflow-y-auto p-2 scrollbar-thin">
					<div className="mb-4">
						<div className="text-xs font-bold text-text-muted uppercase px-3 py-2 mb-1">
							메뉴
						</div>
						<div className="space-y-0.5">
							{links.map((link, index) => {
								const isActive = pathname === link.url || (link.url !== "/" && pathname.startsWith(link.url));

								return (
									<Link
										key={link.id}
										href={link.url}
										draggable
										onDragStart={(e) => handleDragStart(e, link)}
										onDragOver={(e) => handleDragOver(e, index)}
										onDragEnd={handleDragEnd}
										className={classNames(
											"flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors group relative",
											isActive
												? "bg-accent/10 text-accent font-medium border-l-2 border-accent"
												: "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary border-l-2 border-transparent"
										)}
										onClick={() => {
											if (window.innerWidth < 768) onClose();
										}}
									>
										{/* 드래그 핸들 (호버 시 표시) */}
										<div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 cursor-grab p-1 text-text-muted">
											<GripVertical size={12} />
										</div>

										<div className="ml-2 flex items-center gap-2">
											<LayoutGrid size={18} className={isActive ? "text-accent" : "text-text-muted"} />
											<span>{link.title}</span>
										</div>
									</Link>
								);
							})}
						</div>
					</div>

					<div className="mb-4">
						<div className="text-xs font-bold text-text-muted uppercase px-3 py-2 mb-1 flex justify-between items-center group cursor-pointer hover:text-text-primary">
							<span>바로가기</span>
							<Settings size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
						</div>
						{/* 커스텀 링크 영역 (공사중) */}
						<div className="px-3 py-4 text-center text-xs text-text-muted bg-bg-tertiary/30 rounded border border-dashed border-border mx-2">
							<ExternalLink size={16} className="mx-auto mb-1 opacity-50" />
							커스텀 링크 공간
						</div>
					</div>
				</nav>

				{/* 푸터 영역 - 사용자 정보 (레거시 스타일) */}
				<div className="p-3 border-t border-bg-tertiary bg-bg-tertiary/50">
					{session?.user ? (
						<>
							{/* 사용자 정보 카드 */}
							<div
								className="flex items-center gap-2.5 p-2 rounded cursor-pointer hover:bg-bg-secondary transition-colors"
								onClick={() => router.push("/profile")}
							>
								{/* 마인크래프트 헤드 아바타 */}
								{getMinecraftHeadUrl((session.user as { minecraft_uuid?: string }).minecraft_uuid) ? (
									<img
										src={getMinecraftHeadUrl((session.user as { minecraft_uuid?: string }).minecraft_uuid, 32) || ""}
										alt=""
										className="w-8 h-8 rounded"
										style={{ imageRendering: "pixelated" }}
									/>
								) : (
									<div className="w-8 h-8 rounded bg-bg-tertiary flex items-center justify-center text-text-muted font-semibold text-sm">
										{(session.user.nickname || "?")[0].toUpperCase()}
									</div>
								)}

								{/* 닉네임 + 역할 */}
								<div className="flex-1 min-w-0">
									<div className="text-sm font-medium text-text-primary truncate">
										{session.user.nickname}
									</div>
									<div className="text-xs text-text-muted">
										{getRoleText((session.user as { role?: string }).role)}
									</div>
								</div>

								{/* 로그아웃 버튼 */}
								<button
									onClick={(e) => {
										e.stopPropagation();
										signOut();
									}}
									className="px-2 py-1 text-xs text-text-muted bg-transparent hover:bg-error hover:text-white rounded transition-colors"
								>
									로그아웃
								</button>
							</div>

							{/* 문의하기 / 관리자 버튼 */}
							<div className="mt-2 flex gap-2">
								<Link
									href="/inquiries"
									className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-text-secondary bg-bg-secondary hover:bg-bg-tertiary rounded transition-colors"
								>
									<MessageSquare size={14} className="opacity-70" />
									문의하기
								</Link>
								{(session.user as { role?: string }).role === "admin" && (
									<Link
										href="/admin"
										className="flex items-center justify-center px-3 py-1.5 text-xs text-text-secondary bg-bg-secondary hover:bg-bg-tertiary rounded transition-colors"
										title="관리자"
									>
										<Settings size={14} className="opacity-70" />
									</Link>
								)}
							</div>
						</>
					) : (
						<div className="text-xs text-text-muted text-center">
							&copy; 2026 CrafterForum
						</div>
					)}
				</div>
			</aside>
		</>
	);
}
