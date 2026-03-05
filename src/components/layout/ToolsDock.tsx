"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Settings, Wrench } from "lucide-react";
import SidebarSettingsModal from "@/components/sidebar/SidebarSettingsModal";
import SafeImage from "@/components/ui/SafeImage";
import { Modal } from "@/components/ui/Modal";
import { getSidebarSettings, DEFAULT_SETTINGS } from "@/lib/sidebar-settings";
import { type SidebarLink } from "@/lib/sidebar-links";
import { buildSidebarToolLinks } from "@/lib/sidebar-tool-links";

interface ToolsDockProps {
	isVisible: boolean;
}

function renderToolLink(link: SidebarLink, onClick?: () => void) {
	const isExternal = /^https?:\/\//i.test(link.url);
	if (!isExternal && !link.url.startsWith("/")) {
		return null;
	}

	const itemClassName =
		"mb-1 flex items-center gap-2 rounded px-2.5 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary";

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
				onClick={onClick}
			>
				{icon}
				<span className="truncate">{link.title}</span>
			</a>
		);
	}

	return (
		<Link key={link.id} href={link.url} className={itemClassName} title={link.title} onClick={onClick}>
			{icon}
			<span className="truncate">{link.title}</span>
		</Link>
	);
}

export default function ToolsDock({ isVisible }: ToolsDockProps) {
	const [links, setLinks] = useState<SidebarLink[]>(() => buildSidebarToolLinks(DEFAULT_SETTINGS));
	const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
	const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
	const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
	const [isMobileListCollapsed, setIsMobileListCollapsed] = useState(false);

	useEffect(() => {
		const refreshLinks = () => {
			setLinks(buildSidebarToolLinks(getSidebarSettings()));
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

	if (!isVisible) {
		return null;
	}

	return (
		<>
			<div className="pointer-events-none fixed right-4 top-1/2 z-[90] hidden -translate-y-1/2 md:block">
				{isDesktopCollapsed ? (
					<button
						type="button"
						onClick={() => setIsDesktopCollapsed(false)}
						className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-border bg-bg-secondary text-text-primary shadow-lg transition-colors hover:bg-bg-tertiary"
						title="도구 모음 열기"
					>
						<Wrench size={18} />
					</button>
				) : (
					<aside className="pointer-events-auto flex w-56 max-h-[70vh] flex-col overflow-hidden rounded-lg border border-bg-tertiary bg-bg-secondary/95 shadow-lg backdrop-blur">
						<div className="flex items-center justify-between border-b border-bg-tertiary px-3 py-2">
							<div className="text-xs font-semibold tracking-wide text-text-muted">도구 모음</div>
							<div className="flex items-center gap-1">
								<button
									type="button"
									onClick={() => setIsDesktopCollapsed(true)}
									className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
									title="도구 모음 접기"
								>
									<ChevronDown size={12} />
								</button>
								<button
									type="button"
									onClick={() => setIsSettingsModalOpen(true)}
									className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
									title="도구 링크 설정"
								>
									<Settings size={12} /> 설정
								</button>
							</div>
						</div>
						<nav className="custom-scrollbar overflow-y-auto p-2">{links.map((link) => renderToolLink(link))}</nav>
					</aside>
				)}
			</div>

			<button
				type="button"
				onClick={() => setIsMobileModalOpen(true)}
				className="fixed bottom-5 right-4 z-[95] inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-secondary text-text-primary shadow-lg transition-colors hover:bg-bg-tertiary md:hidden"
				title="도구 모음"
			>
				<Wrench size={18} />
			</button>

			<Modal
				isOpen={isMobileModalOpen}
				onClose={() => setIsMobileModalOpen(false)}
				title="도구 모음"
				size="sm"
				variant="sidebarLike"
				bodyClassName="p-3"
			>
				<button
					type="button"
					onClick={() => {
						setIsMobileModalOpen(false);
						setIsSettingsModalOpen(true);
					}}
					className="mb-2 inline-flex w-full items-center justify-center gap-1 rounded border border-border px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
				>
					<Settings size={13} /> 도구 링크 설정
				</button>
				<button
					type="button"
					onClick={() => setIsMobileListCollapsed((prev) => !prev)}
					className="mb-2 inline-flex w-full items-center justify-center gap-1 rounded border border-border px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
				>
					{isMobileListCollapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
					{isMobileListCollapsed ? "도구 목록 펼치기" : "도구 목록 접기"}
				</button>
				{!isMobileListCollapsed ? (
					<nav className="max-h-[60vh] overflow-y-auto">
						{links.map((link) => renderToolLink(link, () => setIsMobileModalOpen(false)))}
					</nav>
				) : null}
			</Modal>

			<SidebarSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
		</>
	);
}
