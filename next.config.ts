import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	images: {
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
