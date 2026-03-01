import "dotenv/config";
import { createClient } from "@libsql/client";

function resolveDatabaseUrl() {
	const fromTurso = (process.env.TURSO_DATABASE_URL ?? "").trim();
	if (fromTurso) {
		return fromTurso;
	}
	const fromDatabase = (process.env.DATABASE_URL ?? "").trim();
	if (fromDatabase) {
		return fromDatabase;
	}
	throw new Error("TURSO_DATABASE_URL or DATABASE_URL is required");
}

async function tableExists(client, tableName) {
	const result = await client.execute({
		sql: "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
		args: [tableName],
	});
	return (result.rows ?? []).length > 0;
}

async function columnExists(client, tableName, columnName) {
	const result = await client.execute(`PRAGMA table_info("${tableName}")`);
	return (result.rows ?? []).some((row) => String(row.name ?? "") === columnName);
}

async function main() {
	const url = resolveDatabaseUrl();
	const authToken = (process.env.TURSO_AUTH_TOKEN ?? "").trim();
	const client = createClient({
		url,
		authToken: authToken || undefined,
	});

	try {
		await client.execute(
			"CREATE TABLE IF NOT EXISTS \"Notification\" (\"id\" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, \"userId\" INTEGER NOT NULL, \"actorId\" INTEGER, \"type\" TEXT NOT NULL, \"message\" TEXT NOT NULL, \"postId\" INTEGER, \"commentId\" INTEGER, \"isRead\" INTEGER NOT NULL DEFAULT 0, \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT \"Notification_userId_fkey\" FOREIGN KEY (\"userId\") REFERENCES \"User\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT \"Notification_actorId_fkey\" FOREIGN KEY (\"actorId\") REFERENCES \"User\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE)"
		);
		await client.execute(
			"CREATE INDEX IF NOT EXISTS \"Notification_userId_isRead_createdAt_idx\" ON \"Notification\"(\"userId\", \"isRead\", \"createdAt\")"
		);

		await client.execute(
			"CREATE TABLE IF NOT EXISTS \"PushSubscription\" (\"id\" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, \"userId\" INTEGER NOT NULL, \"endpoint\" TEXT NOT NULL, \"p256dh\" TEXT NOT NULL, \"auth\" TEXT NOT NULL, \"userAgent\" TEXT, \"isActive\" INTEGER NOT NULL DEFAULT 1, \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, \"updatedAt\" DATETIME NOT NULL, CONSTRAINT \"PushSubscription_userId_fkey\" FOREIGN KEY (\"userId\") REFERENCES \"User\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE)"
		);
		await client.execute(
			"CREATE UNIQUE INDEX IF NOT EXISTS \"PushSubscription_endpoint_key\" ON \"PushSubscription\"(\"endpoint\")"
		);
		await client.execute(
			"CREATE INDEX IF NOT EXISTS \"PushSubscription_userId_isActive_idx\" ON \"PushSubscription\"(\"userId\", \"isActive\")"
		);

		await client.execute(
			"CREATE TABLE IF NOT EXISTS \"NotificationDelivery\" (\"id\" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, \"notificationId\" INTEGER NOT NULL, \"userId\" INTEGER NOT NULL, \"subscriptionId\" INTEGER, \"channel\" TEXT NOT NULL, \"status\" TEXT NOT NULL DEFAULT 'queued', \"attemptCount\" INTEGER NOT NULL DEFAULT 0, \"nextAttemptAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, \"lastErrorCode\" TEXT, \"lastErrorMessage\" TEXT, \"sentAt\" DATETIME, \"dedupeKey\" TEXT NOT NULL, \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, \"updatedAt\" DATETIME NOT NULL, CONSTRAINT \"NotificationDelivery_notificationId_fkey\" FOREIGN KEY (\"notificationId\") REFERENCES \"Notification\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT \"NotificationDelivery_userId_fkey\" FOREIGN KEY (\"userId\") REFERENCES \"User\" (\"id\") ON DELETE CASCADE ON UPDATE CASCADE, CONSTRAINT \"NotificationDelivery_subscriptionId_fkey\" FOREIGN KEY (\"subscriptionId\") REFERENCES \"PushSubscription\" (\"id\") ON DELETE SET NULL ON UPDATE CASCADE)"
		);
		await client.execute(
			"CREATE UNIQUE INDEX IF NOT EXISTS \"NotificationDelivery_dedupeKey_key\" ON \"NotificationDelivery\"(\"dedupeKey\")"
		);
		await client.execute(
			"CREATE INDEX IF NOT EXISTS \"NotificationDelivery_status_nextAttemptAt_idx\" ON \"NotificationDelivery\"(\"status\", \"nextAttemptAt\")"
		);
		await client.execute(
			"CREATE INDEX IF NOT EXISTS \"NotificationDelivery_userId_channel_status_idx\" ON \"NotificationDelivery\"(\"userId\", \"channel\", \"status\")"
		);

		if (await tableExists(client, "Post")) {
			if (!(await columnExists(client, "Post", "commentCount"))) {
				await client.execute("ALTER TABLE \"Post\" ADD COLUMN \"commentCount\" INTEGER NOT NULL DEFAULT 0");
			}
			await client.execute(
				"UPDATE \"Post\" SET \"commentCount\" = (SELECT COUNT(*) FROM \"Comment\" c WHERE c.postId = \"Post\".id)"
			);
		}

		const tableResult = await client.execute(
			"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('Notification','PushSubscription','NotificationDelivery') ORDER BY name"
		);
		const tableNames = (tableResult.rows ?? []).map((row) => String(row.name ?? ""));

		let hasCommentCount = false;
		if (await tableExists(client, "Post")) {
			hasCommentCount = await columnExists(client, "Post", "commentCount");
		}

		console.log(
			JSON.stringify({
				tables: tableNames,
				postCommentCount: hasCommentCount,
			})
		);
	} finally {
		await client.close();
	}
}

main().catch((error) => {
	console.error("[repair-turso-push-schema] failed", error);
	process.exit(1);
});
