import "dotenv/config";
import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

const HELP_TEXT = `
Usage:
  node scripts/migrate-uploads-to-blob.mjs [--dry-run] [--limit=200]

Required environment variables:
  DATABASE_URL           sqlite file URL or Turso URL
  BLOB_READ_WRITE_TOKEN  Vercel Blob read-write token (required unless --dry-run)

Conditional environment variables:
  TURSO_AUTH_TOKEN       required when DATABASE_URL is Turso URL

Options:
  --dry-run              analyze only (no upload/no DB write)
  --limit=NUMBER         max upload rows to migrate (default: all)
  --help                 show help
`.trim();

function parseArgs(argv) {
  const options = {
    dryRun: false,
    limit: Number.POSITIVE_INFINITY,
    help: false,
  };

  for (const arg of argv.slice(2)) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg.startsWith("--limit=")) {
      const raw = arg.split("=")[1];
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --limit value: ${raw}`);
      }
      options.limit = parsed;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function isTursoDatabaseUrl(databaseUrl) {
  const normalized = databaseUrl.trim().toLowerCase();
  return normalized.startsWith("libsql://") || normalized.startsWith("turso://");
}

function resolveConfig(options) {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim() ?? "";
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }
  if (!options.dryRun && !blobToken) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required");
  }
  if (isTursoDatabaseUrl(databaseUrl) && !tursoAuthToken) {
    throw new Error("TURSO_AUTH_TOKEN is required when DATABASE_URL is Turso URL");
  }

  return {
    databaseUrl,
    tursoAuthToken,
    blobToken,
  };
}

function createPrismaClient(config) {
  if (!isTursoDatabaseUrl(config.databaseUrl)) {
    return new PrismaClient({ datasourceUrl: config.databaseUrl });
  }

  const adapter = new PrismaLibSQL({
    url: config.databaseUrl,
    authToken: config.tursoAuthToken,
  });
  return new PrismaClient({ adapter });
}

async function walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolute)));
      continue;
    }
    if (entry.isFile()) {
      files.push(absolute);
    }
  }

  return files;
}

async function buildLocalUploadIndex(root) {
  const roots = [
    path.resolve(root, "public", "uploads"),
    path.resolve(root, "oracle", "uploads"),
  ];

  const byRelativePath = new Map();
  const byBasename = new Map();

  for (const uploadRoot of roots) {
    let files = [];
    try {
      files = await walkFiles(uploadRoot);
    } catch {
      continue;
    }

    for (const absolutePath of files) {
      const relativePath = path.relative(uploadRoot, absolutePath).replace(/\\/g, "/");
      byRelativePath.set(relativePath, absolutePath);

      const basename = path.posix.basename(relativePath);
      const existing = byBasename.get(basename) ?? [];
      existing.push(absolutePath);
      byBasename.set(basename, existing);
    }
  }

  return { byRelativePath, byBasename };
}

function sanitizeStoredPath(raw) {
  const withoutOrigin = raw
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/uploads\//i, "")
    .replace(/^\/+/, "");

  const [withoutQuery] = withoutOrigin.split(/[?#]/, 1);
  return withoutQuery.replace(/\\/g, "/").trim();
}

function isAbsoluteUrl(value) {
  return /^https?:\/\//i.test(value);
}

function resolveUploadSource(storedFilename, index) {
  const normalized = sanitizeStoredPath(storedFilename);
  if (!normalized) {
    return null;
  }

  const direct = index.byRelativePath.get(normalized);
  if (direct) {
    return {
      absolutePath: direct,
      relativePath: normalized,
    };
  }

  const basename = path.posix.basename(normalized);
  const basenameMatches = index.byBasename.get(basename) ?? [];
  if (basenameMatches.length > 0) {
    const absolutePath =
      basenameMatches.find((candidate) =>
        candidate.replace(/\\/g, "/").includes("/public/uploads/")
      ) ?? basenameMatches[0];

    // 업로드 경로 보존을 위해 실제 디렉터리 구조 기준 상대 경로를 재구성
    const relativePath = absolutePath.includes("/uploads/")
      ? absolutePath.split("/uploads/")[1].replace(/\\/g, "/")
      : basename;

    return {
      absolutePath,
      relativePath,
    };
  }

  return null;
}

function inferMimeType(pathOrName) {
  const ext = path.extname(pathOrName).toLowerCase().replace(".", "");
  const map = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
    txt: "text/plain",
    md: "text/markdown",
    json: "application/json",
    zip: "application/zip",
  };
  return map[ext] ?? "application/octet-stream";
}

function normalizeRelativePath(relativePath) {
  return relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
}

function buildBlobPath(relativePath) {
  return `uploads/${normalizeRelativePath(relativePath)}`;
}

function replaceLegacyUploadLinks(content, uploadUrlMap) {
  if (!content) {
    return content;
  }

  return content.replace(/\/uploads\/([^\s"'<>\])]+)/gi, (fullMatch, rawPath) => {
    const pathOnly = rawPath.split(/[?#]/, 1)[0].replace(/\\/g, "/");
    const suffix = rawPath.slice(pathOnly.length);
    const mapped =
      uploadUrlMap.get(pathOnly) ??
      uploadUrlMap.get(path.posix.basename(pathOnly));

    if (!mapped) {
      return fullMatch;
    }

    return `${mapped}${suffix}`;
  });
}

async function migrateUploads(prisma, config, options, index) {
  const uploads = await prisma.upload.findMany({
    orderBy: { id: "asc" },
    select: {
      id: true,
      filename: true,
      originalName: true,
      mimetype: true,
      size: true,
    },
  });

  const uploadUrlMap = new Map();
  const summary = {
    total: uploads.length,
    migrated: 0,
    skipped: 0,
    missingFile: 0,
    limited: 0,
  };

  for (const row of uploads) {
    if (summary.migrated >= options.limit) {
      summary.limited += 1;
      continue;
    }

    if (isAbsoluteUrl(row.filename)) {
      if (row.filename.includes("/uploads/")) {
        const relativePath = normalizeRelativePath(sanitizeStoredPath(row.filename));
        if (relativePath) {
          uploadUrlMap.set(relativePath, row.filename);
          uploadUrlMap.set(path.posix.basename(relativePath), row.filename);
        }
      }
      summary.skipped += 1;
      continue;
    }

    const source = resolveUploadSource(row.filename, index);
    if (!source) {
      summary.missingFile += 1;
      continue;
    }

    const relativePath = normalizeRelativePath(source.relativePath);
    const blobPath = buildBlobPath(relativePath);
    const contentType = row.mimetype || inferMimeType(relativePath);

    let blobUrl = row.filename;
    if (!options.dryRun) {
      const buffer = await readFile(source.absolutePath);
      const uploaded = await put(blobPath, buffer, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType,
        token: config.blobToken,
      });

      blobUrl = uploaded.url;
      await prisma.upload.update({
        where: { id: row.id },
        data: {
          filename: blobUrl,
          mimetype: contentType,
        },
      });
    }

    uploadUrlMap.set(relativePath, blobUrl);
    uploadUrlMap.set(path.posix.basename(relativePath), blobUrl);
    summary.migrated += 1;
  }

  return { summary, uploadUrlMap };
}

async function migrateContentRows(rows, updateFn, uploadUrlMap, dryRun) {
  let changed = 0;

  for (const row of rows) {
    const nextContent = replaceLegacyUploadLinks(row.content, uploadUrlMap);
    if (nextContent === row.content) {
      continue;
    }

    changed += 1;
    if (!dryRun) {
      await updateFn(row.id, nextContent);
    }
  }

  return changed;
}

async function migrateContent(prisma, uploadUrlMap, dryRun) {
  const posts = await prisma.post.findMany({ select: { id: true, content: true } });
  const comments = await prisma.comment.findMany({ select: { id: true, content: true } });
  const inquiries = await prisma.inquiry.findMany({ select: { id: true, content: true } });
  const inquiryReplies = await prisma.inquiryReply.findMany({ select: { id: true, content: true } });

  const postChanged = await migrateContentRows(
    posts,
    (id, content) => prisma.post.update({ where: { id }, data: { content } }),
    uploadUrlMap,
    dryRun
  );
  const commentChanged = await migrateContentRows(
    comments,
    (id, content) => prisma.comment.update({ where: { id }, data: { content } }),
    uploadUrlMap,
    dryRun
  );
  const inquiryChanged = await migrateContentRows(
    inquiries,
    (id, content) => prisma.inquiry.update({ where: { id }, data: { content } }),
    uploadUrlMap,
    dryRun
  );
  const inquiryReplyChanged = await migrateContentRows(
    inquiryReplies,
    (id, content) => prisma.inquiryReply.update({ where: { id }, data: { content } }),
    uploadUrlMap,
    dryRun
  );

  return {
    postChanged,
    commentChanged,
    inquiryChanged,
    inquiryReplyChanged,
  };
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    console.log(HELP_TEXT);
    return;
  }

  const config = resolveConfig(options);
  const prisma = createPrismaClient(config);

  try {
    const projectRoot = process.cwd();
    const index = await buildLocalUploadIndex(projectRoot);

    const indexed = index.byRelativePath.size;
    console.log(`Indexed local upload files: ${indexed}`);

    const { summary, uploadUrlMap } = await migrateUploads(prisma, config, options, index);

    let contentSummary = {
      postChanged: 0,
      commentChanged: 0,
      inquiryChanged: 0,
      inquiryReplyChanged: 0,
    };

    if (uploadUrlMap.size > 0) {
      contentSummary = await migrateContent(prisma, uploadUrlMap, options.dryRun);
    }

    console.table({
      totalUploadRows: summary.total,
      migratedUploadRows: summary.migrated,
      skippedUploadRows: summary.skipped,
      missingUploadFiles: summary.missingFile,
      limitedUploadRows: summary.limited,
      postLinksRewritten: contentSummary.postChanged,
      commentLinksRewritten: contentSummary.commentChanged,
      inquiryLinksRewritten: contentSummary.inquiryChanged,
      inquiryReplyLinksRewritten: contentSummary.inquiryReplyChanged,
      dryRun: options.dryRun,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[migrate-uploads-to-blob] failed:", error);
  process.exit(1);
});
