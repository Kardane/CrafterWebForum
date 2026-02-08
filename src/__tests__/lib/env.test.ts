import { describe, expect, it, vi } from "vitest";

describe("env schema validation", () => {
	it("accepts Turso env with auth token", async () => {
		vi.resetModules();
		vi.stubEnv("DATABASE_URL", "libsql://example.turso.io");
		vi.stubEnv("TURSO_AUTH_TOKEN", "test-token");
		vi.stubEnv("NODE_ENV", "test");
		const mod = await import("@/lib/env");
		expect(mod.default.DATABASE_URL).toBe("libsql://example.turso.io");
	});

	it("accepts valid required envs", async () => {
		vi.resetModules();
		vi.unstubAllEnvs();
		vi.stubEnv("DATABASE_URL", "file:./dev.db");
		vi.stubEnv("NODE_ENV", "test");
		const mod = await import("@/lib/env");
		expect(mod.default.DATABASE_URL).toBe("file:./dev.db");
	});

	it("throws when Turso auth token is missing", async () => {
		vi.resetModules();
		vi.unstubAllEnvs();
		vi.stubEnv("DATABASE_URL", "libsql://example.turso.io");
		vi.stubEnv("NODE_ENV", "test");
		await expect(import("@/lib/env")).rejects.toThrow("TURSO_AUTH_TOKEN");
	});

	it("throws when DATABASE_URL is missing", async () => {
		vi.resetModules();
		vi.unstubAllEnvs();
		delete process.env.DATABASE_URL;
		await expect(import("@/lib/env")).rejects.toThrow();
	});
});
