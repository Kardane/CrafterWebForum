"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Sidebar from "./Sidebar";
import ToolsDock from "./ToolsDock";
import classNames from "classnames";

interface MainLayoutProps {
	children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
	const pathname = usePathname();
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);

	// 인증 플로우 페이지에서는 사이드바/헤더 숨김
	const isAuthPage =
		pathname.startsWith("/login") ||
		pathname.startsWith("/register") ||
		pathname.startsWith("/forgot-password") ||
		pathname.startsWith("/pending") ||
		pathname.startsWith("/auth/");
	const isPostDetailPage = pathname.includes("/posts/") && !pathname.includes("/new") && !pathname.includes("/edit");
	const isPostEditPage = /^\/posts\/[^/]+\/edit(?:\/|$)/.test(pathname);
	const isComposerPage = pathname.includes("/new") || isPostEditPage;
	const showSidebar = !isAuthPage;
	const showHeader = !isAuthPage && !isPostDetailPage && !isComposerPage;

	return (
		<div className="min-h-screen bg-bg-primary text-text-primary font-sans flex text-sm md:text-base">
			{showSidebar && (
				<Sidebar
					isOpen={isSidebarOpen}
					onClose={() => setIsSidebarOpen(false)}
				/>
			)}
			<ToolsDock isVisible={showSidebar} />

			<div className={classNames(
				"flex-1 flex flex-col min-w-0 transition-all duration-300",
				{ "md:ml-sidebar": showSidebar }
			)}>
				{showHeader && <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />}

				<main className={classNames(
					"flex-1",
					{
						"px-4 pb-4 pt-2 md:px-6 md:pb-6 md:pt-4": !isAuthPage && !isPostDetailPage && !isComposerPage,
						"px-3 pb-4 pt-0 md:px-5 md:pb-6 md:pt-0": isPostDetailPage,
						"px-3 pb-5 pt-1 md:px-5 md:pb-7 md:pt-2": isComposerPage,
					}
				)}>
					{children}
				</main>
			</div>
		</div>
	);
}
