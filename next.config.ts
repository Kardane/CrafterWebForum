import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	allowedDevOrigins: ["127.0.0.1", "localhost"],
	turbopack: {},
	serverExternalPackages: ["@prisma/adapter-libsql", "@libsql/client", "libsql"],
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
	webpack(config) {
		config.module.rules.push({
			test: /node_modules[\\/]@libsql[\\/].*(README\.md|LICENSE)$/i,
			type: "asset/source",
		});

		return config;
	},
};

export default nextConfig;
