"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Sidebar from "./Sidebar";
import classNames from "classnames";

interface MainLayoutProps {
	children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
	const pathname = usePathname();
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);

	// 로그인/회원가입 페이지에서는 사이드바 숨김
	const isAuthPage = ["/login", "/register"].includes(pathname);
	const isPostDetailPage = /^\/posts\/\d+$/.test(pathname);
	const showSidebar = !isAuthPage;
	const showHeader = !isAuthPage && !isPostDetailPage;

	return (
		<div className="min-h-screen bg-bg-primary text-text-primary font-sans flex text-sm md:text-base">
			{showSidebar && (
				<Sidebar
					isOpen={isSidebarOpen}
					onClose={() => setIsSidebarOpen(false)}
				/>
			)}

			<div className={classNames(
				"flex-1 flex flex-col min-w-0 transition-all duration-300",
				{ "md:ml-sidebar": showSidebar }
			)}>
				{showHeader && <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />}

				<main className={classNames(
					"flex-1",
					{
						"px-4 pb-4 pt-2 md:px-6 md:pb-6 md:pt-4": !isAuthPage && !isPostDetailPage,
						"px-3 pb-4 pt-0 md:px-5 md:pb-6 md:pt-1": isPostDetailPage,
					}
				)}>
					{children}
				</main>
			</div>
		</div>
	);
}
