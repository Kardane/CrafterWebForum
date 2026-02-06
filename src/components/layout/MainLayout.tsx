"use client";

import { useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import classNames from "classnames";

interface MainLayoutProps {
	children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
	const [isSidebarOpen, setIsSidebarOpen] = useState(false);

	return (
		<div className="min-h-screen bg-bg-primary text-text-primary font-sans flex flex-col">
			<Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

			<div className="flex flex-1 pt-header">
				<Sidebar
					isOpen={isSidebarOpen}
					onClose={() => setIsSidebarOpen(false)}
				/>

				<main className={classNames(
					"flex-1 transition-all duration-300 min-w-0 p-4 md:p-6",
					"md:ml-sidebar" // 데스크탑에서는 사이드바 너비만큼 마진
				)}>
					{children}
				</main>
			</div>
		</div>
	);
}
