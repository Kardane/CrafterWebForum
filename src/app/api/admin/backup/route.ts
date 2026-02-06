import { NextResponse } from "next/server";
import path from "path";
import { mkdir, copyFile, readFile } from "fs/promises";
import { requireAdmin } from "@/lib/admin-auth";

export const runtime = "nodejs";

const BACKUP_COOLDOWN_MS = 10 * 60 * 1000;
let lastBackupAt = 0;

function resolveSqlitePath() {
	const raw = process.env.DATABASE_URL ?? "file:./dev.db";
	if (!raw.startsWith("file:")) {
		return path.resolve(process.cwd(), "prisma", "dev.db");
	}

	const dbRef = raw.slice("file:".length);
	if (path.isAbsolute(dbRef)) return dbRef;
	if (dbRef.startsWith("./")) {
		return path.resolve(process.cwd(), "prisma", dbRef.slice(2));
	}
	return path.resolve(process.cwd(), "prisma", dbRef);
}

function makeBackupName() {
	const now = new Date();
	const yyyy = now.getFullYear().toString();
	const mm = String(now.getMonth() + 1).padStart(2, "0");
	const dd = String(now.getDate()).padStart(2, "0");
	const hh = String(now.getHours()).padStart(2, "0");
	const mi = String(now.getMinutes()).padStart(2, "0");
	const ss = String(now.getSeconds()).padStart(2, "0");
	return `backup-${yyyy}${mm}${dd}-${hh}${mi}${ss}.db`;
}

export async function POST() {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const now = Date.now();
		if (now - lastBackupAt < BACKUP_COOLDOWN_MS) {
			const remainSec = Math.ceil((BACKUP_COOLDOWN_MS - (now - lastBackupAt)) / 1000);
			return NextResponse.json(
				{ error: `Backup cooldown active (${remainSec}s remaining)` },
				{ status: 429 }
			);
		}

		const sourceDb = resolveSqlitePath();
		const backupsDir = path.resolve(process.cwd(), "backups");
		const backupName = makeBackupName();
		const backupPath = path.join(backupsDir, backupName);

		await mkdir(backupsDir, { recursive: true });
		await copyFile(sourceDb, backupPath);

		lastBackupAt = now;
		console.info(
			`[Admin] Backup created by ${admin.session.user.id}: ${backupName}`
		);

		const fileBuffer = await readFile(backupPath);
		return new NextResponse(fileBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/x-sqlite3",
				"Content-Disposition": `attachment; filename="${backupName}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		console.error("[API] POST /api/admin/backup error:", error);
		return NextResponse.json({ error: "Backup failed" }, { status: 500 });
	}
}

