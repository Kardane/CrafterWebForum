import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
		formats: ["image/avif", "image/webp"],
		qualities: [62, 75],
		remotePatterns: [
			{
				protocol: "https",
				hostname: "mineatar.io",
			},
			{
				protocol: "https",
				hostname: "crafatar.com",
			},
			{
				protocol: "https",
				hostname: "**.public.blob.vercel-storage.com",
				pathname: "/uploads/**",
			},
			{
				protocol: "https",
				hostname: "**.blob.vercel-storage.com",
				pathname: "/uploads/**",
			},
		],
	},
};

export default nextConfig;
