import fs from "node:fs";
import path from "node:path";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "vitest/config";

function loadVitestEnv() {
	const root = __dirname;
	const candidatePaths = [".env.local", ".env", ".env.example"].map((name) =>
		path.join(root, name)
	);

	for (const candidatePath of candidatePaths) {
		if (!fs.existsSync(candidatePath)) {
			continue;
		}

		loadDotenv({ path: candidatePath, override: false });
	}

	if (!process.env.DATABASE_URL) {
		process.env.DATABASE_URL = "file:./dev.db";
	}

	if (!process.env.NEXTAUTH_SECRET) {
		process.env.NEXTAUTH_SECRET = "test-nextauth-secret-32chars-minimum";
	}
}

loadVitestEnv();

export default defineConfig({
	test: {
		globals: true,
		environment: "jsdom",
		setupFiles: ["src/__tests__/setup.ts"],
		include: ["src/__tests__/**/*.test.{ts,tsx}"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			all: false,
			exclude: [
				".next/**",
				"src/generated/**",
				"src/__tests__/**",
				"**/*.d.ts",
				"node_modules/**",
			],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
});
