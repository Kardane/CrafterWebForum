import type { RateLimitPolicy } from "@/lib/rate-limit";

export const RATE_LIMIT_POLICIES: Record<string, RateLimitPolicy> = {
	minecraftCode: {
		namespace: "minecraft:code",
		limit: 10,
		windowMs: 60_000,
	},
	minecraftStatus: {
		namespace: "minecraft:status",
		limit: 60,
		windowMs: 60_000,
	},
	minecraftVerify: {
		namespace: "minecraft:verify",
		limit: 30,
		windowMs: 60_000,
	},
	authRegister: {
		namespace: "auth:register",
		limit: 5,
		windowMs: 10 * 60_000,
	},
};
