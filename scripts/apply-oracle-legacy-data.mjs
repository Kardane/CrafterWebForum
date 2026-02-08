import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const TABLES = {
	user: '"User"',
	tag: '"Tag"',
	link: '"Link"',
	upload: '"Upload"',
	post: '"Post"',
	comment: '"Comment"',
	like: '"Like"',
	postRead: '"PostRead"',
	minecraftCode: '"MinecraftCode"',
	inquiry: '"Inquiry"',
	inquiryReply: '"InquiryReply"',
};

function mustExist(filePath, label) {
	if (!fs.existsSync(filePath)) {
		throw new Error(`${label} not found: ${filePath}`);
	}
}

function nowStamp() {
	const d = new Date();
	const pad = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function countTables(db, targetTables) {
	const result = {};
	for (const [label, tableName] of Object.entries(targetTables)) {
		result[label] = db.prepare(`SELECT COUNT(*) AS c FROM ${tableName}`).get().c;
	}
	return result;
}

function printSummary(title, summary) {
	console.log(`\n[${title}]`);
	console.table(summary);
}

function copyDirectoryRecursive(sourceRoot, targetRoot) {
	if (!fs.existsSync(sourceRoot)) {
		return { copied: 0, skipped: 0 };
	}

	let copied = 0;
	let skipped = 0;

	const walk = (sourceDir) => {
		for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
			const sourcePath = path.join(sourceDir, entry.name);
			const relativePath = path.relative(sourceRoot, sourcePath);
			const targetPath = path.join(targetRoot, relativePath);

			if (entry.isDirectory()) {
				fs.mkdirSync(targetPath, { recursive: true });
				walk(sourcePath);
				continue;
			}

			if (!entry.isFile()) {
				skipped += 1;
				continue;
			}

			fs.mkdirSync(path.dirname(targetPath), { recursive: true });
			fs.copyFileSync(sourcePath, targetPath);
			copied += 1;
		}
	};

	fs.mkdirSync(targetRoot, { recursive: true });
	walk(sourceRoot);
	return { copied, skipped };
}

function applyLegacyData(sourceDbPath, targetDbPath) {
	const target = new DatabaseSync(targetDbPath);
	const sourceAliasPath = sourceDbPath.replace(/'/g, "''");

	try {
		const beforeCounts = countTables(target, TABLES);
		printSummary("target-before", beforeCounts);

		target.exec("PRAGMA foreign_keys = OFF;");
		target.exec(`ATTACH DATABASE '${sourceAliasPath}' AS legacy;`);
		target.exec("BEGIN IMMEDIATE TRANSACTION;");

		// 의존 관계 역순으로 대상 데이터 정리
		target.exec(`
			DELETE FROM ${TABLES.inquiryReply};
			DELETE FROM ${TABLES.inquiry};
			DELETE FROM ${TABLES.minecraftCode};
			DELETE FROM ${TABLES.postRead};
			DELETE FROM ${TABLES.like};
			DELETE FROM ${TABLES.comment};
			DELETE FROM ${TABLES.post};
			DELETE FROM ${TABLES.upload};
			DELETE FROM ${TABLES.link};
			DELETE FROM ${TABLES.tag};
			DELETE FROM ${TABLES.user};
		`);

		// users
		target.exec(`
			INSERT INTO ${TABLES.user}
			(id, email, password, nickname, role, emailVerified, isBanned, isApproved, minecraftUuid, minecraftNickname, lastAuthAt, signupNote, createdAt, deletedAt)
			SELECT
				id,
				email,
				password,
				nickname,
				COALESCE(role, 'user'),
				COALESCE(email_verified, 0),
				COALESCE(is_banned, 0),
				COALESCE(is_approved, 0),
				minecraft_uuid,
				minecraft_nickname,
				last_auth_at,
				signup_note,
				COALESCE(created_at, CURRENT_TIMESTAMP),
				deleted_at
			FROM legacy.users;
		`);

		// tags
		target.exec(`
			INSERT INTO ${TABLES.tag}
			(id, name, color)
			SELECT
				id,
				name,
				COALESCE(color, '#5865F2')
			FROM legacy.tags;
		`);

		// links
		target.exec(`
			INSERT INTO ${TABLES.link}
			(id, title, url, iconUrl, category, sortOrder)
			SELECT
				id,
				title,
				url,
				icon_url,
				COALESCE(category, 'external'),
				COALESCE(sort_order, 0)
			FROM legacy.links;
		`);

		// uploads
		target.exec(`
			INSERT INTO ${TABLES.upload}
			(id, filename, originalName, mimetype, size, createdAt)
			SELECT
				id,
				filename,
				original_name,
				mimetype,
				size,
				COALESCE(created_at, CURRENT_TIMESTAMP)
			FROM legacy.uploads;
		`);

		// posts
		target.exec(`
			INSERT INTO ${TABLES.post}
			(id, title, content, authorId, tags, likes, views, createdAt, updatedAt, deletedAt)
			SELECT
				id,
				title,
				content,
				author_id,
				tags,
				COALESCE(likes, 0),
				0,
				COALESCE(created_at, CURRENT_TIMESTAMP),
				COALESCE(created_at, CURRENT_TIMESTAMP),
				deleted_at
			FROM legacy.posts;
		`);

		// comments
		target.exec(`
			INSERT INTO ${TABLES.comment}
			(id, postId, authorId, content, isPinned, parentId, createdAt, updatedAt)
			SELECT
				id,
				post_id,
				author_id,
				content,
				COALESCE(is_pinned, 0),
				NULL,
				COALESCE(created_at, CURRENT_TIMESTAMP),
				COALESCE(created_at, CURRENT_TIMESTAMP)
			FROM legacy.comments;
		`);

		// likes
		target.exec(`
			INSERT INTO ${TABLES.like}
			(id, postId, userId)
			SELECT
				id,
				post_id,
				user_id
			FROM legacy.likes;
		`);

		// post_reads
		target.exec(`
			INSERT INTO ${TABLES.postRead}
			(userId, postId, lastReadCommentCount, updatedAt)
			SELECT
				user_id,
				post_id,
				COALESCE(last_read_comment_count, 0),
				COALESCE(updated_at, CURRENT_TIMESTAMP)
			FROM legacy.post_reads;
		`);

		// minecraft_codes
		target.exec(`
			INSERT INTO ${TABLES.minecraftCode}
			(code, userId, ipAddress, isVerified, linkedNickname, linkedUuid, createdAt)
			SELECT
				code,
				user_id,
				ip_address,
				COALESCE(is_verified, 0),
				linked_nickname,
				linked_uuid,
				COALESCE(created_at, CURRENT_TIMESTAMP)
			FROM legacy.minecraft_codes;
		`);

		// inquiries
		target.exec(`
			INSERT INTO ${TABLES.inquiry}
			(id, authorId, title, content, status, createdAt, archivedAt)
			SELECT
				id,
				author_id,
				title,
				content,
				COALESCE(status, 'pending'),
				COALESCE(created_at, CURRENT_TIMESTAMP),
				NULL
			FROM legacy.inquiries;
		`);

		// inquiry_replies
		target.exec(`
			INSERT INTO ${TABLES.inquiryReply}
			(id, inquiryId, authorId, content, createdAt)
			SELECT
				id,
				inquiry_id,
				author_id,
				content,
				COALESCE(created_at, CURRENT_TIMESTAMP)
			FROM legacy.inquiry_replies;
		`);

		target.exec("COMMIT;");
		target.exec("DETACH DATABASE legacy;");
		target.exec("PRAGMA foreign_keys = ON;");

		const afterCounts = countTables(target, TABLES);
		printSummary("target-after", afterCounts);

		return { beforeCounts, afterCounts };
	} catch (error) {
		try {
			target.exec("ROLLBACK;");
		} catch {
			// 롤백 실패는 원본 에러 우선
		}
		throw error;
	} finally {
		target.close();
	}
}

function main() {
	const root = process.cwd();
	const sourceDbPath = path.resolve(root, "oracle", "forum.db");
	const targetDbPath = path.resolve(root, "prisma", "dev.db");
	const sourceUploadsPath = path.resolve(root, "oracle", "uploads");
	const targetUploadsPath = path.resolve(root, "public", "uploads");
	const backupDir = path.resolve(root, "prisma", "backups");

	mustExist(sourceDbPath, "legacy DB");
	mustExist(targetDbPath, "target DB");

	fs.mkdirSync(backupDir, { recursive: true });
	const backupPath = path.join(backupDir, `dev_before_oracle_import_${nowStamp()}.db`);
	fs.copyFileSync(targetDbPath, backupPath);
	console.log(`[backup] ${backupPath}`);

	const { afterCounts } = applyLegacyData(sourceDbPath, targetDbPath);
	const uploadResult = copyDirectoryRecursive(sourceUploadsPath, targetUploadsPath);

	printSummary("uploads-sync", uploadResult);
	console.log("\n[done] oracle legacy data applied");
	console.log(`[done] posts=${afterCounts.post}, comments=${afterCounts.comment}, users=${afterCounts.user}`);
}

try {
	main();
} catch (error) {
	console.error("[apply-oracle-legacy-data] failed:", error);
	process.exit(1);
}
