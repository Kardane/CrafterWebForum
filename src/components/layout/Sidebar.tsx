"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import classNames from "classnames";
import { Settings, HelpCircle, Shield } from "lucide-react";
import SidebarSettingsModal from "../sidebar/SidebarSettingsModal";
import { DEFAULT_SETTINGS, getSidebarSettings, normalizeSidebarUrl } from "@/lib/sidebar-settings";
import { SidebarLink, DEFAULT_LINKS } from "@/lib/sidebar-links";
import { isPrivilegedNickname } from "@/config/admin-policy";

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

function buildSidebarLinks(settings = DEFAULT_SETTINGS): SidebarLink[] {
	const customLinks = (settings.customLinks || []).reduce<SidebarLink[]>((acc, link) => {
		const normalizedUrl = normalizeSidebarUrl(link.url);
		if (!normalizedUrl) {
			return acc;
		}

		acc.push({
			...link,
			url: normalizedUrl,
			isCustom: true,
		});
		return acc;
	}, []);

	let allLinks: SidebarLink[] = [...DEFAULT_LINKS, ...customLinks];

	if (settings.order && settings.order.length > 0) {
		const orderMap = new Map(settings.order.map((id, index) => [id, index]));
		allLinks.sort((a, b) => {
			const orderA = orderMap.get(a.id!) ?? 9999;
			const orderB = orderMap.get(b.id!) ?? 9999;
			return orderA - orderB;
		});
	} else {
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

	if (settings.hidden) {
		const hiddenIds = settings.hidden;
		allLinks = allLinks.filter((link) => !hiddenIds.includes(link.id!));
	}

	if (settings.deleted) {
		const deletedIds = settings.deleted;
		allLinks = allLinks.filter((link) => !deletedIds.includes(link.id!));
	}

	return allLinks;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
	const pathname = usePathname();
	const router = useRouter();
	const { data: session } = useSession();
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [links, setLinks] = useState<SidebarLink[]>(() => buildSidebarLinks(DEFAULT_SETTINGS));
	const [inquiryCount, setInquiryCount] = useState(0);

	const user = session?.user;
	const canAccessAdmin = user
		? user.role === "admin" || isPrivilegedNickname(user.nickname)
		: false;

	useEffect(() => {
		const refreshLinks = () => {
			setLinks(buildSidebarLinks(getSidebarSettings()));
		};
		const controller = new AbortController();

		const loadInquiryCount = async () => {
			if (!canAccessAdmin) {
				setInquiryCount(0);
				return;
			}

			try {
				const res = await fetch("/api/inquiries/pending-count", {
					cache: "no-store",
					signal: controller.signal,
				});

				if (res.status === 401 || res.status === 403) {
					setInquiryCount(0);
					return;
				}

				if (!res.ok) {
					setInquiryCount(0);
					return;
				}

				const data = (await res.json()) as { count?: number };
				setInquiryCount(Number(data.count ?? 0));
			} catch (error) {
				const abortError = error as { name?: string };
				if (abortError.name === "AbortError") {
					return;
				}
				setInquiryCount(0);
			}
		};

		refreshLinks();
		void loadInquiryCount();

		const handleStorage = (event: StorageEvent) => {
			if (event.key === "sidebarSettings") {
				refreshLinks();
			}
		};
		window.addEventListener("storage", handleStorage);
		window.addEventListener("sidebarSettingsChanged", refreshLinks);

		return () => {
			controller.abort();
			window.removeEventListener("storage", handleStorage);
			window.removeEventListener("sidebarSettingsChanged", refreshLinks);
		};
	}, [canAccessAdmin]);

	const renderLink = (link: SidebarLink) => {
		const isExternal = /^https?:\/\//i.test(link.url);
		if (!isExternal && !link.url.startsWith("/")) {
			return null;
		}
		const isActive = !isExternal && (pathname === link.url || (link.url !== "/" && pathname.startsWith(link.url)));
		const itemClassName = classNames(
			"mb-1 flex items-center gap-2 rounded px-2.5 py-2 text-sm transition-colors",
			isActive
				? "bg-accent/20 text-text-primary"
				: "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
		);

		const icon = (
			<img
				src={link.icon_url || "https://via.placeholder.com/20"}
				className="h-5 w-5 rounded object-contain"
				alt=""
				width={20}
				height={20}
			/>
		);

		if (isExternal) {
			return (
				<a
					key={link.id}
					href={link.url}
					target="_blank"
					rel="noreferrer"
					className={itemClassName}
					title={link.title}
				>
					{icon}
					<span className="truncate">{link.title}</span>
				</a>
			);
		}

		return (
			<Link key={link.id} href={link.url} className={itemClassName} title={link.title}>
				{icon}
				<span className="truncate">{link.title}</span>
			</Link>
		);
	};

	return (
		<>
			<div
				className={classNames(
					"fixed inset-0 z-[99] bg-black/70 backdrop-blur-sm md:hidden",
					isOpen ? "block" : "hidden"
				)}
				onClick={onClose}
			/>

			<aside
				className={classNames(
					"fixed inset-y-0 left-0 z-sidebar flex w-sidebar flex-col border-r border-bg-tertiary bg-bg-secondary transition-transform duration-300 md:translate-x-0",
					isOpen ? "translate-x-0" : "-translate-x-full"
				)}
			>
				<div className="border-b border-bg-tertiary p-2">
					<button
						type="button"
						onClick={() => setIsSettingsOpen(true)}
						className="inline-flex w-full items-center gap-1 rounded px-2 py-1.5 text-xs text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
					>
						<Settings size={12} /> 사이드바 설정
					</button>
				</div>

				<nav className="flex-1 overflow-y-auto p-2">{links.map((link) => renderLink(link))}</nav>

				{user ? (
					<div className="border-t border-bg-tertiary bg-bg-tertiary p-3">
						<div className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-bg-secondary">
							<Link href="/profile" className="flex min-w-0 flex-1 items-center gap-2">
								<div className="h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border bg-bg-secondary">
									{user.minecraftUuid ? (
										<img
											src={getMinecraftHeadUrl(user.minecraftUuid) || ""}
											alt={user.nickname}
											className="h-full w-full object-cover"
										/>
									) : (
										<div className="flex h-full w-full items-center justify-center text-xs font-semibold text-text-muted">
											{getInitials(user.nickname)}
										</div>
									)}
								</div>
								<div className="min-w-0">
									<div className="truncate text-sm font-medium text-text-primary">{user.nickname}</div>
									<div className="text-[11px] text-text-muted">
										{canAccessAdmin ? "관리자" : "사용자"}
									</div>
								</div>
							</Link>

							<button
								className="rounded px-2 py-1 text-xs text-text-muted transition-colors hover:bg-error hover:text-white"
								onClick={() => signOut({ callbackUrl: "/login" })}
								title="로그아웃"
							>
								로그아웃
							</button>
						</div>

						<div className="mt-2 flex gap-2">
							<Link
								href="/inquiries"
								className="flex flex-1 items-center gap-1.5 rounded px-2.5 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
							>
								<HelpCircle size={16} />
								<span>문의하기</span>
								{canAccessAdmin && inquiryCount > 0 && (
									<span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white">
										{inquiryCount}
									</span>
								)}
							</Link>

							{canAccessAdmin ? (
								<Link
									href="/admin"
									className="flex h-9 w-9 items-center justify-center rounded text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary"
									title="관리자"
								>
									<Shield size={16} />
								</Link>
							) : (
								<div
									className="flex h-9 w-9 items-center justify-center rounded text-text-muted/60"
									title="관리자"
								>
									<Shield size={16} />
								</div>
							)}
						</div>
					</div>
				) : (
					<div className="border-t border-bg-tertiary bg-bg-tertiary p-3">
						<button
							onClick={() => router.push("/login")}
							className="btn btn-primary w-full"
						>
							로그인
						</button>
					</div>
				)}
			</aside>

			<SidebarSettingsModal
				isOpen={isSettingsOpen}
				onClose={() => setIsSettingsOpen(false)}
			/>
		</>
	);
}
