import path from "node:path";
import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/upload-constants";

const BLOCKED_EXTENSIONS = new Set([
	"exe",
	"bat",
	"cmd",
	"ps1",
	"sh",
	"js",
	"mjs",
	"cjs",
	"php",
	"py",
	"rb",
	"dll",
	"com",
	"jar",
]);

const MIME_BY_EXTENSION: Record<string, readonly string[]> = {
	jpg: ["image/jpeg"],
	jpeg: ["image/jpeg"],
	png: ["image/png"],
	gif: ["image/gif"],
	webp: ["image/webp"],
	mp4: ["video/mp4"],
	webm: ["video/webm"],
	mov: ["video/quicktime"],
	pdf: ["application/pdf"],
	txt: ["text/plain"],
	md: ["text/markdown", "text/plain"],
	json: ["application/json", "text/json"],
	zip: [
		"application/zip",
		"application/x-zip-compressed",
		"multipart/x-zip",
	],
};

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "webm", "mov"]);

export const VIDEO_UPLOAD_MIME_TYPES = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const IMAGE_UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export type UploadKind = "image" | "video" | "file";

export interface UploadValidationResult {
	kind: UploadKind;
	extension: string;
	mimeType: string;
	originalName: string;
	size: number;
}

export interface UploadPathInfo {
	uploadRoot: string;
	absoluteDir: string;
	relativeDir: string;
}

export class UploadValidationError extends Error {
	status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.status = status;
	}
}

export function sanitizeOriginalName(name: string): string {
	const base = path.basename(name).trim();
	const replaced = base.replace(/[^\w.\-() ]+/g, "_");
	return replaced || "file";
}

function getExtension(name: string): string {
	const ext = path.extname(name).toLowerCase().replace(".", "");
	if (!ext) {
		throw new UploadValidationError("Missing file extension");
	}
	return ext;
}

export function validateUploadFile(file: File): UploadValidationResult {
	return validateUploadMetadata({
		originalName: file.name,
		mimeType: file.type,
		size: file.size,
	});
}

export function validateUploadMetadata(input: {
	originalName: string;
	mimeType: string;
	size: number;
}): UploadValidationResult {
	if (input.size <= 0) {
		throw new UploadValidationError("Empty file");
	}
	if (input.size > MAX_UPLOAD_BYTES) {
		throw new UploadValidationError(`File exceeds ${MAX_UPLOAD_MB}MB limit`, 413);
	}

	const originalName = sanitizeOriginalName(input.originalName);
	const extension = getExtension(originalName);
	const mimeType = (input.mimeType || "").toLowerCase();

	if (BLOCKED_EXTENSIONS.has(extension)) {
		throw new UploadValidationError("Blocked file extension");
	}

	const allowedMimes = MIME_BY_EXTENSION[extension];
	if (!allowedMimes) {
		throw new UploadValidationError("Unsupported file extension");
	}
	if (!mimeType || !allowedMimes.includes(mimeType)) {
		throw new UploadValidationError("MIME type does not match extension");
	}

	return {
		kind: IMAGE_EXTENSIONS.has(extension)
			? "image"
			: VIDEO_EXTENSIONS.has(extension)
				? "video"
				: "file",
		extension,
		mimeType,
		originalName,
		size: input.size,
	};
}

export async function ensureUploadPath(): Promise<UploadPathInfo> {
	const uploadRoot = path.resolve(process.cwd(), "public", "uploads");
	const relativeDir = getUploadRelativeDir();
	const absoluteDir = path.join(uploadRoot, relativeDir);

	await mkdir(absoluteDir, { recursive: true });
	return { uploadRoot, absoluteDir, relativeDir };
}

export function getUploadRelativeDir(date: Date = new Date()): string {
	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return path.posix.join(year, month);
}

export function toBlobObjectPath(relativeDir: string, filename: string): string {
	const normalizedDir = relativeDir.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	const normalizedFilename = path.posix.basename(filename).replace(/\\/g, "/");
	if (!normalizedDir) {
		return `uploads/${normalizedFilename}`;
	}
	return `uploads/${normalizedDir}/${normalizedFilename}`;
}

export function createStoredFileName(extension: string): string {
	return `${randomUUID()}.${extension}`;
}

export function toPublicUploadUrl(relativePath: string): string {
	return `/uploads/${relativePath.replace(/\\/g, "/")}`;
}
