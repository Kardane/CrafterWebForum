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
	const showSidebar = !isAuthPage;

	return (
		<div className="min-h-screen bg-bg-primary text-text-primary font-sans flex flex-col">
			<Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

			<div className="flex flex-1 pt-header">
				{showSidebar && (
					<Sidebar
						isOpen={isSidebarOpen}
						onClose={() => setIsSidebarOpen(false)}
					/>
				)}

				<main className={classNames(
					"flex-1 transition-all duration-300 min-w-0 p-4 md:p-6",
					{ "md:ml-sidebar": showSidebar } // 데스크탑에서는 사이드바 너비만큼 마진 (사이드바 있을 때만)
				)}>
					{children}
				</main>
			</div>
		</div>
	);
}
