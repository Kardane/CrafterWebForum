"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import classNames from "classnames";
import { Settings, LogOut, HelpCircle, Shield } from "lucide-react";
import SidebarSettingsModal from "../sidebar/SidebarSettingsModal";
import { getSidebarSettings } from "@/lib/sidebar-settings";
import { SidebarLink, DEFAULT_LINKS } from "@/lib/sidebar-links";

interface SidebarProps {
	isOpen: boolean;
	onClose: () => void;
}

/**
 * 마인크래프트 헤드 이미지 URL
 */
function getMinecraftHeadUrl(uuid: string | null, size = 32): string | null {
	if (!uuid) return null;
	return `https://api.mineatar.io/face/${uuid}?scale=${Math.ceil(size / 8)}`;
}

/**
 * 이니셜 추출
 */
function getInitials(name: string): string {
	return name ? name.charAt(0).toUpperCase() : "?";
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
	const pathname = usePathname();
	const router = useRouter();
	const { data: session } = useSession();
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [links, setLinks] = useState<SidebarLink[]>([]);
	const [inquiryCount, setInquiryCount] = useState(0);

	// 사이드바 링크 로드
	const loadLinks = () => {
		const settings = getSidebarSettings();
		const customLinks: SidebarLink[] = (settings.customLinks || []).map((l: any) => ({
			...l,
			isCustom: true
		}));

		// 기본 링크와 커스텀 링크 병합
		let allLinks = [...DEFAULT_LINKS, ...customLinks];

		// 정렬 적용
		if (settings.order && settings.order.length > 0) {
			const orderMap = new Map(settings.order.map((id, index) => [id, index]));
			allLinks.sort((a, b) => {
				const orderA = orderMap.get(a.id!) ?? 9999;
				const orderB = orderMap.get(b.id!) ?? 9999;
				return orderA - orderB;
			});
		} else {
			// 기본 정렬 (카테고리 -> 정렬 순서)
			allLinks.sort((a, b) => {
				const catA = a.category || "기타";
				const catB = b.category || "기타";
				const catCompare = catA.localeCompare(catB);

				if (catCompare !== 0) return catCompare;

				const orderA = a.sort_order ?? 9999;
				const orderB = b.sort_order ?? 9999;
				return orderA - orderB;
			});
		}

		// 숨김 처리
		if (settings.hidden) {
			allLinks = allLinks.filter((l) => !settings.hidden.includes(l.id!));
		}

		// 삭제 처리 (기본 링크)
		if (settings.deleted) {
			allLinks = allLinks.filter((l) => !settings.deleted!.includes(l.id!));
		}

		setLinks(allLinks);
	};

	// 문의하기 카운트 로드 (Mock)
	const loadInquiryCount = async () => {
		if (session?.user && (session.user as any).role === "admin") {
			try {
				// TODO: 실제 API 연동 (/api/inquiries/pending-count)
				// const res = await fetch('/api/inquiries/pending-count');
				// const data = await res.json();
				// setInquiryCount(data.count);
				setInquiryCount(0);
			} catch (e) {
				console.error("Failed to load inquiry count", e);
			}
		}
	};

	useEffect(() => {
		loadLinks();
		loadInquiryCount();

		// 설정 변경 이벤트 리스너
		window.addEventListener("storage", (e) => {
			if (e.key === "sidebarSettings") loadLinks();
		});

		// 커스텀 이벤트 리스너 (설정 모달에서 발생시킴)
		window.addEventListener("sidebarSettingsChanged", loadLinks);

		return () => {
			window.removeEventListener("storage", loadLinks);
			window.removeEventListener("sidebarSettingsChanged", loadLinks);
		};
	}, [session]); // session 변경 시 문의하기 카운트 갱신

	// 링크 아이템 렌더링
	const renderLink = (link: SidebarLink) => {
		const isActive = pathname === link.url || (link.url !== "/" && pathname.startsWith(link.url));

		return (
			<a
				key={link.id}
				href={link.url}
				target={link.url.startsWith("http") ? "_blank" : "_self"}
				className={classNames("nav-item", { active: isActive })}
				title={link.title}
			>
				<img
					src={link.icon_url || "https://via.placeholder.com/20"}
					className="nav-item-icon w-5 h-5 object-contain min-w-[20px] min-h-[20px]"
					alt=""
					width={20}
					height={20}
				/>
				<span className="nav-item-text">{link.title}</span>
			</a>
		);
	};

	const user = session?.user as any;

	return (
		<>
			{/* 모바일 오버레이 */}
			<div
				className={classNames("sidebar-overlay", { active: isOpen })}
				onClick={onClose}
			/>

			{/* 사이드바 본체 */}
			<aside className={classNames("sidebar", { open: isOpen })}>
				{/* 사이드바 헤더 */}
				<div className="sidebar-header-custom">
					<span className="header-title">바로가기</span>
					<button
						className="btn-icon-sm"
						onClick={() => setIsSettingsOpen(true)}
						title="사이드바 설정"
					>
						<Settings size={14} />
					</button>
				</div>

				{/* 네비게이션 */}
				<nav className="sidebar-nav">
					{links.map((link) => renderLink(link))}
				</nav>

				{/* 푸터 (사용자 정보) */}
				{user ? (
					<div className="sidebar-footer">
						<div className="flex items-center justify-between mb-2">
							<Link href="/profile" className="flex items-center gap-2.5 flex-1 min-w-0 hover:bg-bg-secondary p-1.5 rounded-md transition-colors group">
								<div className="sidebar-user-avatar shrink-0">
									{user.minecraftUuid ? (
										<img
											src={getMinecraftHeadUrl(user.minecraftUuid) || ""}
											alt={user.nickname}
										/>
									) : (
										<div className="avatar-fallback">{getInitials(user.nickname)}</div>
									)}
								</div>
								<div className="sidebar-user-info overflow-hidden">
									<div className="sidebar-user-name group-hover:text-accent transition-colors">{user.nickname}</div>
									<div className="sidebar-user-role">
										{user.role === "admin" ? "관리자" : "사용자"}
									</div>
								</div>
							</Link>

							<button
								className="sidebar-logout-btn shrink-0 ml-1"
								onClick={() => signOut({ callbackUrl: "/login" })}
								title="로그아웃"
							>
								<LogOut size={15} />
							</button>
						</div>

						<div className="footer-actions grid grid-cols-2 gap-2">
							<Link href="/inquiries" className="footer-action-btn justify-center">
								<HelpCircle size={14} />
								<span className="whitespace-nowrap overflow-hidden text-ellipsis">문의하기</span>
								{inquiryCount > 0 && (
									<span className="inquiry-badge ml-1">{inquiryCount}</span>
								)}
							</Link>

							{user.role === "admin" ? (
								<Link href="/admin" className="footer-action-btn justify-center" title="관리자">
									<Shield size={14} />
									<span className="whitespace-nowrap overflow-hidden text-ellipsis">관리자</span>
								</Link>
							) : (
								<div className="footer-action-btn disabled opacity-50 cursor-not-allowed justify-center">
									<Shield size={14} />
									<span className="whitespace-nowrap overflow-hidden text-ellipsis">관리자</span>
								</div>
							)}
						</div>
					</div>
				) : (
					<div className="sidebar-footer">
						<div className="p-2">
							<button
								onClick={() => router.push("/login")}
								className="w-full btn btn-primary btn-sm"
							>
								로그인
							</button>
						</div>
					</div>
				)}
			</aside>

			{/* 설정 모달 */}
			<SidebarSettingsModal
				isOpen={isSettingsOpen}
				onClose={() => setIsSettingsOpen(false)}
			/>

			<style jsx>{`
				/* 사이드바 기본 스타일 (globals.css 와 일부 겹칠 수 있으나 상세 구현) */
				.sidebar-overlay {
					position: fixed;
					inset: 0;
					background: rgba(0, 0, 0, 0.7);
					backdrop-filter: blur(4px);
					z-index: 99;
					display: none;
				}

				.sidebar-overlay.active {
					display: block;
				}

				.sidebar {
					width: var(--spacing-sidebar);
					background: var(--color-bg-secondary);
					display: flex;
					flex-direction: column;
					border-right: 1px solid var(--color-bg-tertiary);
					height: 100vh;
					position: fixed;
					left: 0;
					top: 0;
					bottom: 0;
					z-index: 100;
					transition: transform 0.3s ease;
				}

				.sidebar-header-custom {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 16px 12px 8px 16px;
					margin-top: 56px; /* 헤더 높이만큼 띄움 (헤더가 fixed인 경우) */
				}

				/* 모바일 대응: 헤더가 fixed면 사이드바도 그 아래로 */
				@media (min-width: 769px) {
					.sidebar {
						top: 0;
						height: 100vh;
						margin-top: 0;
					}
					.sidebar-header-custom {
						margin-top: 0;
					}
				}

				.header-title {
					font-size: 0.85rem;
					font-weight: 600;
					color: var(--color-text-secondary);
				}

				.btn-icon-sm {
					background: none;
					border: none;
					color: var(--color-text-muted);
					cursor: pointer;
					padding: 4px;
					border-radius: 4px;
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.btn-icon-sm:hover {
					color: var(--color-text-primary);
					background: var(--color-bg-tertiary);
				}

				.sidebar-nav {
					flex: 1;
					overflow-y: auto;
					padding: 8px;
				}

				.nav-item {
					display: flex;
					align-items: center;
					gap: 10px;
					padding: 8px 12px;
					border-radius: 4px;
					color: var(--color-text-secondary);
					font-size: 0.95rem;
					text-decoration: none;
					margin-bottom: 2px;
					transition: all 0.15s;
				}

				.nav-item:hover {
					background: var(--color-bg-tertiary);
					color: var(--color-text-primary);
				}

				.nav-item.active {
					background: rgba(139, 35, 50, 0.15); /* Accent color opacity */
					color: var(--color-text-primary);
					font-weight: 500;
				}

				.nav-item-icon {
					width: 20px;
					height: 20px;
					border-radius: 4px;
					object-fit: contain;
				}

				.sidebar-footer {
					padding: 12px;
					background: var(--color-bg-tertiary);
					border-top: 1px solid var(--color-border);
				}

				.sidebar-user {
					display: flex;
					align-items: center;
					gap: 10px;
					padding: 8px;
					border-radius: 4px;
					cursor: pointer;
					transition: background 0.15s;
					margin-bottom: 8px;
				}

				.sidebar-user:hover {
					background: var(--color-bg-secondary);
				}

				.sidebar-user-avatar img {
					width: 32px;
					height: 32px;
					border-radius: 4px;
				}

				.avatar-fallback {
					width: 32px;
					height: 32px;
					border-radius: 4px;
					background: var(--color-bg-secondary);
					display: flex;
					align-items: center;
					justify-content: center;
					font-weight: 600;
					color: var(--color-text-muted);
					border: 1px solid var(--color-border);
				}

				.sidebar-user-info {
					flex: 1;
					min-width: 0;
				}

				.sidebar-user-name {
					font-size: 0.9rem;
					font-weight: 500;
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					display: block;
					color: var(--color-text-primary);
				}

				.sidebar-user-role {
					font-size: 0.75rem;
					color: var(--color-text-muted);
				}

				.sidebar-logout-btn {
					background: none;
					border: none;
					color: var(--color-text-muted);
					cursor: pointer;
					padding: 6px;
					border-radius: 4px;
				}

				.sidebar-logout-btn:hover {
					background: var(--color-error);
					color: white;
				}

				.footer-actions {
					display: flex;
					gap: 8px;
				}

				.footer-action-btn {
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 6px;
					padding: 6px 10px;
					background: var(--color-bg-secondary); /* 배경색 변경: tertiary -> secondary (대비) */
					border: 1px solid var(--color-border);
					border-radius: 4px;
					color: var(--color-text-secondary);
					font-size: 0.85rem;
					text-decoration: none;
					transition: all 0.15s;
				}

				.footer-action-btn:hover {
					background: var(--color-bg-primary); /* hover 시 더 밝게? */
					color: var(--color-text-primary);
					border-color: var(--color-text-muted);
				}

				.footer-action-btn.icon-only {
					padding: 6px;
					width: 34px; /* 정사각형에 가깝게 */
				}

				.inquiry-badge {
					background: var(--color-accent);
					color: white;
					font-size: 0.7rem;
					padding: 0 5px;
					border-radius: 10px;
					min-width: 16px;
					height: 16px;
					display: flex;
					align-items: center;
					justify-content: center;
					line-height: 1;
				}

				/* 모바일 반응형 */
				@media (max-width: 768px) {
					.sidebar {
						transform: translateX(-100%);
						top: 0;
						height: 100vh;
						margin-top: 0;
						box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
					}
					.sidebar.open {
						transform: translateX(0);
					}
					.sidebar-header-custom {
						margin-top: 0; 
						border-bottom: 1px solid var(--color-border);
						/* 모바일에서는 상단에 로고나 닫기 버튼 등이 추가될 수 있음 */
					}
				}
			`}</style>
		</>
	);
}
