import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "@/styles/globals.css";
import MainLayout from "@/components/layout/MainLayout";
import SessionProvider from "@/components/providers/SessionProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
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
	const isProduction = process.env.NODE_ENV === "production";

	return (
		<html lang="ko">
			<body className="antialiased bg-bg-primary text-text-primary">
				<SessionProvider>
					<ToastProvider>
						<MainLayout>{children}</MainLayout>
					</ToastProvider>
				</SessionProvider>
				{isProduction && (
					<>
						<Analytics />
						<SpeedInsights />
					</>
				)}
			</body>
		</html>
	);
}
