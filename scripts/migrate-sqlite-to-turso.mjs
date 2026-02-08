import "dotenv/config";
import path from "node:path";
import { PrismaClient } from "../src/generated/client/index.js";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

function parseArgs(argv) {
	const options = {
		dryRun: false,
		force: false,
		chunkSize: 400,
	};

	for (const arg of argv.slice(2)) {
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (arg === "--force") {
			options.force = true;
			continue;
		}
		if (arg.startsWith("--chunk-size=")) {
			const raw = arg.split("=")[1];
			const parsed = Number.parseInt(raw, 10);
			if (Number.isFinite(parsed) && parsed > 0) {
				options.chunkSize = parsed;
				continue;
			}
			throw new Error(`Invalid --chunk-size value: ${raw}`);
		}
		if (arg === "--help" || arg === "-h") {
			options.help = true;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	return options;
}

function printHelp() {
	console.log(`
Usage:
  node scripts/migrate-sqlite-to-turso.mjs [--dry-run] [--force] [--chunk-size=400]

Required environment variables:
  TURSO_DATABASE_URL   libsql://<db>.turso.io
  TURSO_AUTH_TOKEN     Turso auth token

Optional environment variables:
  SOURCE_DATABASE_URL  Source sqlite URL (default: file:./prisma/dev.db)

Options:
  --dry-run            Print source counts only, no writes
  --force              Clear target DB first, then migrate
  --chunk-size=NUMBER  createMany chunk size (default: 400)
`.trim());
}

function resolveConfig() {
	const sourceUrl = resolveSourceDatabaseUrl(
		process.env.SOURCE_DATABASE_URL ?? "file:./prisma/dev.db"
	);
	const targetUrl = process.env.TURSO_DATABASE_URL;
	const targetAuthToken = process.env.TURSO_AUTH_TOKEN;

	return { sourceUrl, targetUrl, targetAuthToken };
}

function resolveSourceDatabaseUrl(rawSourceUrl) {
	if (!rawSourceUrl.startsWith("file:")) {
		throw new Error("SOURCE_DATABASE_URL must be a sqlite file URL (file:...)");
	}

	const dbRef = rawSourceUrl.slice("file:".length);
	if (dbRef.length === 0) {
		throw new Error("SOURCE_DATABASE_URL file path is empty");
	}

	if (path.isAbsolute(dbRef)) {
		return `file:${dbRef}`;
	}

	if (dbRef.startsWith("./") || dbRef.startsWith("../")) {
		return `file:${path.resolve(process.cwd(), dbRef)}`;
	}

	return `file:${path.resolve(process.cwd(), dbRef)}`;
}

function createSourceClient(sourceUrl) {
	return new PrismaClient({ datasourceUrl: sourceUrl });
}

function createTargetClient(targetUrl, targetAuthToken) {
	const adapter = new PrismaLibSQL({
		url: targetUrl,
		authToken: targetAuthToken,
	});
	return new PrismaClient({ adapter });
}

async function loadSourceData(source) {
	// FK 의존성을 고려한 로딩 순서
	const users = await source.user.findMany({ orderBy: { id: "asc" } });
	const tags = await source.tag.findMany({ orderBy: { id: "asc" } });
	const links = await source.link.findMany({ orderBy: { id: "asc" } });
	const uploads = await source.upload.findMany({ orderBy: { id: "asc" } });
	const posts = await source.post.findMany({ orderBy: { id: "asc" } });
	const comments = await source.comment.findMany({ orderBy: { id: "asc" } });
	const likes = await source.like.findMany({ orderBy: { id: "asc" } });
	const postReads = await source.postRead.findMany({
		orderBy: [{ userId: "asc" }, { postId: "asc" }],
	});
	const minecraftCodes = await source.minecraftCode.findMany({ orderBy: { code: "asc" } });
	const inquiries = await source.inquiry.findMany({ orderBy: { id: "asc" } });
	const inquiryReplies = await source.inquiryReply.findMany({ orderBy: { id: "asc" } });

	return {
		users,
		tags,
		links,
		uploads,
		posts,
		comments,
		likes,
		postReads,
		minecraftCodes,
		inquiries,
		inquiryReplies,
	};
}

function printCounts(data) {
	const summary = {
		users: data.users.length,
		tags: data.tags.length,
		links: data.links.length,
		uploads: data.uploads.length,
		posts: data.posts.length,
		comments: data.comments.length,
		likes: data.likes.length,
		postReads: data.postReads.length,
		minecraftCodes: data.minecraftCodes.length,
		inquiries: data.inquiries.length,
		inquiryReplies: data.inquiryReplies.length,
	};
	console.table(summary);
}

function filterInvalidForeignKeyRows(sourceData) {
	const userIdSet = new Set(sourceData.users.map((row) => row.id));
	const postIdSet = new Set();
	const inquiryIdSet = new Set();

	const posts = sourceData.posts.filter((row) => userIdSet.has(row.authorId));
	for (const row of posts) {
		postIdSet.add(row.id);
	}

	const comments = [];
	const commentIdSet = new Set();
	for (const row of sortCommentsByParentDependency(sourceData.comments)) {
		const authorValid = userIdSet.has(row.authorId);
		const postValid = postIdSet.has(row.postId);
		const parentValid = row.parentId == null || commentIdSet.has(row.parentId);
		if (!authorValid || !postValid || !parentValid) {
			continue;
		}
		comments.push(row);
		commentIdSet.add(row.id);
	}

	const likes = sourceData.likes.filter(
		(row) => userIdSet.has(row.userId) && postIdSet.has(row.postId)
	);
	const postReads = sourceData.postReads.filter(
		(row) => userIdSet.has(row.userId) && postIdSet.has(row.postId)
	);
	const minecraftCodes = sourceData.minecraftCodes.filter(
		(row) => row.userId == null || userIdSet.has(row.userId)
	);

	const inquiries = sourceData.inquiries.filter((row) => userIdSet.has(row.authorId));
	for (const row of inquiries) {
		inquiryIdSet.add(row.id);
	}
	const inquiryReplies = sourceData.inquiryReplies.filter(
		(row) => inquiryIdSet.has(row.inquiryId) && userIdSet.has(row.authorId)
	);

	const filtered = {
		users: sourceData.users,
		tags: sourceData.tags,
		links: sourceData.links,
		uploads: sourceData.uploads,
		posts,
		comments,
		likes,
		postReads,
		minecraftCodes,
		inquiries,
		inquiryReplies,
	};

	const dropped = {
		posts: sourceData.posts.length - posts.length,
		comments: sourceData.comments.length - comments.length,
		likes: sourceData.likes.length - likes.length,
		postReads: sourceData.postReads.length - postReads.length,
		minecraftCodes: sourceData.minecraftCodes.length - minecraftCodes.length,
		inquiries: sourceData.inquiries.length - inquiries.length,
		inquiryReplies: sourceData.inquiryReplies.length - inquiryReplies.length,
	};

	return { filtered, dropped };
}

async function assertTargetSchemaReady(target) {
	try {
		await target.user.count();
	} catch (error) {
		throw new Error(
			`Target schema is not ready. Run schema push first (example):\n` +
				`DATABASE_URL="$TURSO_DATABASE_URL" npx prisma db push\n` +
				`Original error: ${error instanceof Error ? error.message : String(error)}`
		);
	}
}

async function getTargetCounts(target) {
	return {
		users: await target.user.count(),
		tags: await target.tag.count(),
		links: await target.link.count(),
		uploads: await target.upload.count(),
		posts: await target.post.count(),
		comments: await target.comment.count(),
		likes: await target.like.count(),
		postReads: await target.postRead.count(),
		minecraftCodes: await target.minecraftCode.count(),
		inquiries: await target.inquiry.count(),
		inquiryReplies: await target.inquiryReply.count(),
	};
}

async function ensureTargetEmptyOrForce(target, force) {
	const counts = await getTargetCounts(target);
	const hasAnyData = Object.values(counts).some((count) => count > 0);

	if (!hasAnyData) {
		return;
	}

	if (!force) {
		console.log("Target database is not empty");
		console.table(counts);
		throw new Error("Target DB must be empty. Use --force to clear target DB first.");
	}

	// FK 역순으로 지워서 제약 충돌 방지
	await target.inquiryReply.deleteMany();
	await target.inquiry.deleteMany();
	await target.minecraftCode.deleteMany();
	await target.postRead.deleteMany();
	await target.like.deleteMany();
	await target.comment.deleteMany();
	await target.post.deleteMany();
	await target.upload.deleteMany();
	await target.link.deleteMany();
	await target.tag.deleteMany();
	await target.user.deleteMany();
}

async function createManyInChunks(delegate, rows, chunkSize) {
	for (let i = 0; i < rows.length; i += chunkSize) {
		const chunk = rows.slice(i, i + chunkSize);
		if (chunk.length === 0) continue;
		await delegate.createMany({ data: chunk });
	}
}

function sortCommentsByParentDependency(comments) {
	// 부모 댓글이 먼저 들어가도록 위상 정렬 형태로 재배치
	const pending = [...comments];
	const inserted = new Set();
	const ordered = [];

	while (pending.length > 0) {
		const nextPending = [];
		const ready = [];

		for (const comment of pending) {
			if (comment.parentId == null || inserted.has(comment.parentId)) {
				ready.push(comment);
			} else {
				nextPending.push(comment);
			}
		}

		if (ready.length === 0) {
			throw new Error("Comment dependency cycle detected");
		}

		for (const comment of ready) {
			inserted.add(comment.id);
			ordered.push(comment);
		}

		pending.splice(0, pending.length, ...nextPending);
	}

	return ordered;
}

async function migrateData(target, sourceData, chunkSize) {
	await createManyInChunks(target.user, sourceData.users, chunkSize);
	await createManyInChunks(target.tag, sourceData.tags, chunkSize);
	await createManyInChunks(target.link, sourceData.links, chunkSize);
	await createManyInChunks(target.upload, sourceData.uploads, chunkSize);
	await createManyInChunks(target.post, sourceData.posts, chunkSize);
	await createManyInChunks(target.comment, sourceData.comments, chunkSize);

	await createManyInChunks(target.like, sourceData.likes, chunkSize);
	await createManyInChunks(target.postRead, sourceData.postReads, chunkSize);
	await createManyInChunks(target.minecraftCode, sourceData.minecraftCodes, chunkSize);
	await createManyInChunks(target.inquiry, sourceData.inquiries, chunkSize);
	await createManyInChunks(target.inquiryReply, sourceData.inquiryReplies, chunkSize);
}

async function main() {
	const options = parseArgs(process.argv);
	if (options.help) {
		printHelp();
		return;
	}

	const config = resolveConfig();
	const source = createSourceClient(config.sourceUrl);
	let target = null;

	try {
		console.log("Loading source data...");
		const sourceData = await loadSourceData(source);
		printCounts(sourceData);

		const { filtered, dropped } = filterInvalidForeignKeyRows(sourceData);
		const droppedTotal = Object.values(dropped).reduce((acc, value) => acc + value, 0);
		if (droppedTotal > 0) {
			console.log("Dropping rows with broken foreign keys before migration:");
			console.table(dropped);
		}
		printCounts(filtered);

		if (options.dryRun) {
			console.log("Dry-run complete. No data written.");
			return;
		}

		if (!config.targetUrl) {
			throw new Error("TURSO_DATABASE_URL is required");
		}
		if (!config.targetAuthToken) {
			throw new Error("TURSO_AUTH_TOKEN is required");
		}
		if (!config.targetUrl.startsWith("libsql://") && !config.targetUrl.startsWith("turso://")) {
			throw new Error("TURSO_DATABASE_URL must start with libsql:// or turso://");
		}

		target = createTargetClient(config.targetUrl, config.targetAuthToken);

		console.log("Checking target schema...");
		await assertTargetSchemaReady(target);

		console.log("Checking target database state...");
		await ensureTargetEmptyOrForce(target, options.force);

		console.log("Migrating data to Turso...");
		await migrateData(target, filtered, options.chunkSize);

		console.log("Migration completed successfully.");
	} finally {
		await Promise.allSettled([source.$disconnect(), target?.$disconnect()]);
	}
}

main().catch((error) => {
	console.error("[migrate-sqlite-to-turso] failed:", error);
	process.exit(1);
});
