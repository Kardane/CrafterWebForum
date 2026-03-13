"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { PanelRightClose, PanelRightOpen, Settings, Wrench, X } from "lucide-react";
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
	const pathname = usePathname();
	const [links, setLinks] = useState<SidebarLink[]>(() => buildSidebarToolLinks(DEFAULT_SETTINGS));
	const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
	const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
	const [isDesktopOpen, setIsDesktopOpen] = useState(false);
	const isComposerPage = pathname.includes("/new") || /^\/posts\/[^/]+\/edit(?:\/|$)/.test(pathname);

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

	useEffect(() => {
		if (!isVisible || !isDesktopOpen) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsDesktopOpen(false);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isDesktopOpen, isVisible]);

	if (!isVisible) {
		return null;
	}

	return (
		<>
			<button
				type="button"
				onClick={() => setIsDesktopOpen(true)}
				className={classNames(
					"fixed right-0 top-1/2 z-[90] hidden -translate-y-1/2 rounded-l-2xl border border-r-0 border-bg-tertiary bg-bg-primary/85 px-3 py-3 text-text-muted shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur transition-colors hover:bg-bg-tertiary hover:text-text-primary md:inline-flex",
					isDesktopOpen ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
				)}
				title="도구 모음 열기"
				aria-label="도구 모음 열기"
			>
				<span className="flex items-center gap-2">
					<PanelRightOpen size={16} />
					<span className="text-xs font-semibold tracking-[0.2em]">도구</span>
				</span>
			</button>

			<button
				type="button"
				onClick={() => setIsDesktopOpen(false)}
				className={classNames(
					"fixed inset-0 z-[89] hidden bg-black/20 backdrop-blur-[1px] transition-opacity duration-200 md:block",
					isDesktopOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
				)}
				aria-label="도구 모음 닫기"
			/>

			<aside
				className={classNames(
					"fixed right-0 top-1/2 z-[91] hidden w-[18.5rem] -translate-y-1/2 overflow-hidden rounded-l-2xl border border-r-0 border-bg-tertiary bg-bg-secondary/95 shadow-[0_12px_36px_rgba(0,0,0,0.36)] backdrop-blur transition-all duration-300 ease-out md:block",
					isDesktopOpen ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-full opacity-0"
				)}
				aria-hidden={!isDesktopOpen}
			>
				<div className="flex min-h-[18rem] flex-col">
					<div className="flex items-center justify-between border-b border-bg-tertiary px-3 py-2">
						<div>
							<div className="text-xs font-semibold tracking-wide text-text-muted">도구 모음</div>
							<div className="text-[11px] text-text-muted/80">자주 쓰는 링크 빠른 열기</div>
						</div>
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => setIsSettingsModalOpen(true)}
								className="inline-flex h-8 w-8 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
								title="도구 링크 설정"
							>
								<Settings size={14} />
							</button>
							<button
								type="button"
								onClick={() => setIsDesktopOpen(false)}
								className="inline-flex h-8 w-8 items-center justify-center rounded text-text-muted transition-colors hover:bg-bg-tertiary hover:text-text-primary"
								title="도구 모음 닫기"
							>
								<X size={14} />
							</button>
						</div>
					</div>
					<nav className="custom-scrollbar max-h-[70vh] overflow-y-auto p-2">
						{links.map((link) => renderToolLink(link))}
					</nav>
					<div className="border-t border-bg-tertiary px-2 py-2">
						<button
							type="button"
							onClick={() => setIsDesktopOpen(false)}
							className="inline-flex w-full items-center justify-center gap-2 rounded border border-border px-2 py-2 text-xs text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
							title="도구 모음 접기"
						>
							<PanelRightClose size={14} />
							접기
						</button>
					</div>
				</div>
			</aside>

			{!isComposerPage && (
				<button
					type="button"
					onClick={() => setIsMobileModalOpen(true)}
					className="fixed bottom-5 right-4 z-[95] inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-bg-secondary text-text-primary shadow-lg transition-colors hover:bg-bg-tertiary md:hidden"
					title="도구 모음"
				>
					<Wrench size={18} />
				</button>
			)}

			<Modal
				isOpen={isMobileModalOpen}
				onClose={() => setIsMobileModalOpen(false)}
				title="도구 모음"
				size="sm"
				variant="sidebarLike"
				bodyClassName="p-3"
			>
				<div className="mb-2 flex gap-2">
					<button
						type="button"
						onClick={() => {
							setIsMobileModalOpen(false);
							setIsSettingsModalOpen(true);
						}}
						className={classNames(
							"inline-flex flex-1 items-center justify-center gap-1 rounded border border-border px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
						)}
					>
						<Settings size={13} /> 도구 링크 설정
					</button>
					<button
						type="button"
						onClick={() => setIsMobileModalOpen(false)}
						className="inline-flex h-[34px] w-[34px] items-center justify-center rounded border border-border text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
						aria-label="도구 모음 닫기"
					>
						<X size={14} />
					</button>
				</div>
				<nav className="max-h-[60vh] overflow-y-auto">
					{links.map((link) => renderToolLink(link, () => setIsMobileModalOpen(false)))}
				</nav>
			</Modal>

			<SidebarSettingsModal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} />
		</>
	);
}
