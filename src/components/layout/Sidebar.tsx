"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import classNames from "classnames";
import { Settings, HelpCircle, Shield } from "lucide-react";
import SidebarSettingsModal from "../sidebar/SidebarSettingsModal";
import SafeImage from "@/components/ui/SafeImage";
import UserAvatar from "@/components/ui/UserAvatar";
import { DEFAULT_SETTINGS, getSidebarSettings, normalizeSidebarUrl } from "@/lib/sidebar-settings";
import { SidebarLink, DEFAULT_LINKS, compareSidebarLinks } from "@/lib/sidebar-links";
import { isPrivilegedNickname } from "@/config/admin-policy";
import { usePendingInquiryCount } from "@/components/layout/usePendingInquiryCount";

interface SidebarProps {
	isOpen: boolean;
	onClose: () => void;
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
		allLinks.sort(compareSidebarLinks);
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

	const user = session?.user;
	const canAccessAdmin = user
		? user.role === "admin" || isPrivilegedNickname(user.nickname)
		: false;
	const { inquiryCount } = usePendingInquiryCount(canAccessAdmin);

	useEffect(() => {
		const refreshLinks = () => {
			setLinks(buildSidebarLinks(getSidebarSettings()));
		};

		refreshLinks();

		const handleStorage = (event: StorageEvent) => {
			if (event.key === "sidebarSettings") {
				refreshLinks();
			}
		};
		window.addEventListener("storage", handleStorage);
		window.addEventListener("sidebarSettingsChanged", refreshLinks);

		return () => {
			window.removeEventListener("storage", handleStorage);
			window.removeEventListener("sidebarSettingsChanged", refreshLinks);
		};
	}, []);

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
			<SafeImage
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
								<UserAvatar
									nickname={user.nickname}
									uuid={user.minecraftUuid}
									size={32}
									className="h-8 w-8"
								/>
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
