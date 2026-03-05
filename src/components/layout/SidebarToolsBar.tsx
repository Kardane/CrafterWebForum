"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import classNames from "classnames";
import { ChevronDown, ChevronUp, Settings, Wrench } from "lucide-react";
import SidebarSettingsModal from "@/components/sidebar/SidebarSettingsModal";
import SafeImage from "@/components/ui/SafeImage";
import { getSidebarSettings, DEFAULT_SETTINGS } from "@/lib/sidebar-settings";
import { type SidebarLink } from "@/lib/sidebar-links";
import { buildSidebarToolLinks } from "@/lib/sidebar-tool-links";

function renderToolLink(link: SidebarLink) {
	const isExternal = /^https?:\/\//i.test(link.url);
	if (!isExternal && !link.url.startsWith("/")) {
		return null;
	}

	const itemClassName =
		"mb-1 flex items-center gap-2 rounded px-2 py-1.5 text-xs text-text-secondary transition-colors hover:bg-bg-secondary hover:text-text-primary";

	const icon = (
		<SafeImage
			src={link.icon_url || "https://via.placeholder.com/20"}
			className="h-4 w-4 rounded object-contain"
			alt=""
			width={16}
			height={16}
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
}

export default function SidebarToolsBar() {
	const [links, setLinks] = useState<SidebarLink[]>(() => buildSidebarToolLinks(DEFAULT_SETTINGS));
	const [isOpen, setIsOpen] = useState(false);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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

	return (
		<>
			<div className="mt-2 rounded border border-bg-secondary bg-bg-primary/40 px-2 py-1.5">
				<div className="flex items-center justify-between">
					<button
						type="button"
						onClick={() => setIsOpen((prev) => !prev)}
						className="inline-flex items-center gap-1 rounded px-1 py-1 text-xs text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary"
					>
						<Wrench size={13} />
						도구 모음
						{isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
					</button>
					<button
						type="button"
						onClick={() => setIsSettingsOpen(true)}
						className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-text-muted transition-colors hover:bg-bg-secondary hover:text-text-primary"
						title="도구 링크 설정"
					>
						<Settings size={12} />
					</button>
				</div>
				{isOpen ? <div className={classNames("mt-1 max-h-44 overflow-y-auto")}>{links.map((link) => renderToolLink(link))}</div> : null}
			</div>

			<SidebarSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
		</>
	);
}
