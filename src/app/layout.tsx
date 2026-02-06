import type { Metadata } from "next";
import "@/styles/globals.css";
import MainLayout from "@/components/layout/MainLayout";
import SessionProvider from "@/components/providers/SessionProvider";
// ^ 별도 파일로 분리 필요


export const metadata: Metadata = {
	title: "CrafterForum - 마인크래프트 커뮤니티",
	description: "마인크래프트 유저들을 위한 공간",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="ko">
			<body className="antialiased bg-bg-primary text-text-primary">
				<SessionProvider>
					<MainLayout>{children}</MainLayout>
				</SessionProvider>
			</body>
		</html>
	);
}
