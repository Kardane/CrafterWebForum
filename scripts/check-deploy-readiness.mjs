import "dotenv/config";
import { createClient } from "@libsql/client";

const args = new Set(process.argv.slice(2));
const withDb = args.has("--with-db");

/**
 * 배포 전 환경/연결성 점검
 * - 민감정보 값은 출력하지 않음
 */
function runChecks() {
	const checks = [];
	let hasFailure = false;

	const pushCheck = (name, ok, detail) => {
		checks.push({
			check: name,
			status: ok ? "PASS" : "FAIL",
			detail,
		});
		if (!ok) {
			hasFailure = true;
		}
	};

	const env = process.env;
	const databaseUrl = env.DATABASE_URL?.trim() ?? "";
	const isTursoDatabase = /^libsql:\/\/|^turso:\/\//i.test(databaseUrl);
	const tursoAuthToken = env.TURSO_AUTH_TOKEN?.trim() ?? "";
	const nextAuthSecret = env.NEXTAUTH_SECRET?.trim() ?? "";
	const nextAuthUrl = env.NEXTAUTH_URL?.trim() ?? "";
	const authTrustHost = env.AUTH_TRUST_HOST?.trim() ?? "";

	const knownPlaceholderSecrets = new Set([
		"your-super-secret-key-change-this-in-production-min-32-chars",
		"test-secret-key-for-local-tests",
	]);

	pushCheck("DATABASE_URL is set", databaseUrl.length > 0, databaseUrl ? "configured" : "missing");
	pushCheck(
		"DATABASE_URL uses Turso(libSQL)",
		isTursoDatabase,
		databaseUrl || "missing"
	);
	pushCheck(
		"TURSO_AUTH_TOKEN is set",
		tursoAuthToken.length > 0,
		tursoAuthToken ? "configured" : "missing"
	);
	pushCheck(
		"NEXTAUTH_SECRET looks production-ready",
		nextAuthSecret.length >= 32 && !knownPlaceholderSecrets.has(nextAuthSecret),
		`length=${nextAuthSecret.length}`
	);
	pushCheck(
		"NEXTAUTH_URL is set",
		nextAuthUrl.length > 0,
		nextAuthUrl || "missing"
	);
	pushCheck(
		"NEXTAUTH_URL uses https",
		/^https:\/\//i.test(nextAuthUrl),
		nextAuthUrl || "missing"
	);
	pushCheck(
		"AUTH_TRUST_HOST=true",
		authTrustHost === "true",
		authTrustHost || "missing"
	);

	return { checks, hasFailure, withDb, isTursoDatabase, databaseUrl, tursoAuthToken };
}

async function checkTursoConnectivity(databaseUrl, tursoAuthToken) {
	let client;
	try {
		client = createClient({
			url: databaseUrl,
			authToken: tursoAuthToken,
		});
		await client.execute("SELECT 1 as ok");
		return { ok: true, detail: "connected" };
	} catch (error) {
		return {
			ok: false,
			detail: error instanceof Error ? error.message.split("\n")[0] : String(error),
		};
	} finally {
		await client?.close();
	}
}

async function main() {
	const summary = runChecks();
	const checks = [...summary.checks];
	let hasFailure = summary.hasFailure;

	if (summary.withDb) {
		if (!summary.isTursoDatabase || !summary.tursoAuthToken) {
			checks.push({
				check: "Turso DB connectivity",
				status: "FAIL",
				detail: "DATABASE_URL/TURSO_AUTH_TOKEN not ready",
			});
			hasFailure = true;
		} else {
			const dbResult = await checkTursoConnectivity(summary.databaseUrl, summary.tursoAuthToken);
			checks.push({
				check: "Turso DB connectivity",
				status: dbResult.ok ? "PASS" : "FAIL",
				detail: dbResult.detail,
			});
			if (!dbResult.ok) {
				hasFailure = true;
			}
		}
	}

	console.table(checks);
	if (hasFailure) {
		process.exit(1);
	}
}

main().catch((error) => {
	console.error("[check-deploy-readiness] failed:", error);
	process.exit(1);
});
