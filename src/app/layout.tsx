import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "@/styles/globals.css";
import MainLayout from "@/components/layout/MainLayout";
import SessionProvider from "@/components/providers/SessionProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
// ^ 별도 파일로 분리 필요


export const metadata: Metadata = {
	title: "스티브 갤러리 개발 포럼",
	description: "스티브 갤러리 개발 포럼",
	icons: {
		icon: [
			{ url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
			{ url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
		],
		apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
	},
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
