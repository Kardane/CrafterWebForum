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
	const blobReadWriteToken = env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
	const nextAuthSecret = env.NEXTAUTH_SECRET?.trim() ?? "";
	const minecraftVerifySecret = env.MINECRAFT_VERIFY_SECRET?.trim() ?? "";
	const nextAuthUrl = env.NEXTAUTH_URL?.trim() ?? "";
	const authTrustHost = env.AUTH_TRUST_HOST?.trim() ?? "";

	const knownPlaceholderSecrets = new Set([
		"your-super-secret-key-change-this-in-production-min-32-chars",
		"replace-with-long-random-secret",
		"replace-with-minecraft-verify-secret",
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
		"BLOB_READ_WRITE_TOKEN is set",
		blobReadWriteToken.length > 0,
		blobReadWriteToken ? "configured" : "missing"
	);
	pushCheck(
		"NEXTAUTH_SECRET looks production-ready",
		nextAuthSecret.length >= 32 && !knownPlaceholderSecrets.has(nextAuthSecret),
		`length=${nextAuthSecret.length}`
	);
	pushCheck(
		"MINECRAFT_VERIFY_SECRET looks production-ready",
		minecraftVerifySecret.length >= 32 &&
			!knownPlaceholderSecrets.has(minecraftVerifySecret),
		`length=${minecraftVerifySecret.length}`
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

async function checkRequiredTables(databaseUrl, tursoAuthToken, tableNames) {
	let client;
	try {
		client = createClient({
			url: databaseUrl,
			authToken: tursoAuthToken,
		});
		const placeholders = tableNames.map(() => "?").join(", ");
		const result = await client.execute({
			sql: `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`,
			args: tableNames,
		});
		const existingNames = new Set((result.rows ?? []).map((row) => String(row.name ?? "")));
		const missingNames = tableNames.filter((name) => !existingNames.has(name));
		return {
			ok: missingNames.length === 0,
			detail:
				missingNames.length === 0
					? "all required tables exist"
					: `missing: ${missingNames.join(", ")}`,
		};
	} catch (error) {
		return {
			ok: false,
			detail: error instanceof Error ? error.message.split("\n")[0] : String(error),
		};
	} finally {
		await client?.close();
	}
}

function toSafeNumber(value) {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : 0;
	}
	if (typeof value === "bigint") {
		return Number(value);
	}
	if (typeof value === "string") {
		const parsed = Number.parseInt(value, 10);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

async function checkRequiredColumns(databaseUrl, tursoAuthToken, tableName, columnNames) {
	let client;
	try {
		client = createClient({
			url: databaseUrl,
			authToken: tursoAuthToken,
		});
		const result = await client.execute(`PRAGMA table_info('${tableName}')`);
		const existingColumns = new Set((result.rows ?? []).map((row) => String(row.name ?? "")));
		const missingColumns = columnNames.filter((column) => !existingColumns.has(column));
		return {
			ok: missingColumns.length === 0,
			detail:
				missingColumns.length === 0
					? `${tableName} columns ready`
					: `missing columns on ${tableName}: ${missingColumns.join(", ")}`,
		};
	} catch (error) {
		return {
			ok: false,
			detail: error instanceof Error ? error.message.split("\n")[0] : String(error),
		};
	} finally {
		await client?.close();
	}
}

async function checkPostDataIntegrity(databaseUrl, tursoAuthToken) {
	let client;
	try {
		client = createClient({
			url: databaseUrl,
			authToken: tursoAuthToken,
		});
		const nullTagsResult = await client.execute(
			"SELECT COUNT(*) AS count FROM Post WHERE deletedAt IS NULL AND tags IS NULL"
		);
		const mismatchResult = await client.execute(
			"SELECT COUNT(*) AS count FROM Post p WHERE p.deletedAt IS NULL AND p.commentCount != (SELECT COUNT(*) FROM Comment c WHERE c.postId = p.id)"
		);
		const nullTags = toSafeNumber(nullTagsResult.rows?.[0]?.count);
		const mismatchedCommentCounts = toSafeNumber(mismatchResult.rows?.[0]?.count);
		return {
			nullTags,
			mismatchedCommentCounts,
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
			} else {
				const requiredTableResult = await checkRequiredTables(
					summary.databaseUrl,
					summary.tursoAuthToken,
					["NotificationDelivery", "PushSubscription", "Notification"]
				);
				checks.push({
					check: "Required push tables exist",
					status: requiredTableResult.ok ? "PASS" : "FAIL",
					detail: requiredTableResult.detail,
				});
				if (!requiredTableResult.ok) {
					hasFailure = true;
				}
				const requiredColumnsResult = await checkRequiredColumns(
					summary.databaseUrl,
					summary.tursoAuthToken,
					"Post",
					["commentCount"]
				);
				checks.push({
					check: "Post required columns exist",
					status: requiredColumnsResult.ok ? "PASS" : "FAIL",
					detail: requiredColumnsResult.detail,
				});
				if (!requiredColumnsResult.ok) {
					hasFailure = true;
				}
				if (requiredColumnsResult.ok) {
					const integrityResult = await checkPostDataIntegrity(
						summary.databaseUrl,
						summary.tursoAuthToken
					);
					checks.push({
						check: "Post tags are normalized(non-null)",
						status: integrityResult.nullTags === 0 ? "PASS" : "FAIL",
						detail: `null_tags=${integrityResult.nullTags}`,
					});
					checks.push({
						check: "Post.commentCount is synchronized",
						status: integrityResult.mismatchedCommentCounts === 0 ? "PASS" : "FAIL",
						detail: `mismatched_posts=${integrityResult.mismatchedCommentCounts}`,
					});
					if (integrityResult.nullTags > 0 || integrityResult.mismatchedCommentCounts > 0) {
						hasFailure = true;
					}
				}
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
