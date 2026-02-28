"use client";

import { upload } from "@vercel/blob/client";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "@/lib/upload-constants";

export interface ClientVideoUploadResult {
	success: true;
	type: "video";
	url: string;
	originalName: string;
	mimeType: string;
	size: number;
	filename: string;
}

function toMonthPath(date: Date): string {
	const year = String(date.getFullYear());
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${year}/${month}`;
}

function getExtension(name: string): string {
	const index = name.lastIndexOf(".");
	if (index <= 0 || index === name.length - 1) {
		throw new Error("Missing file extension");
	}
	return name.slice(index + 1).toLowerCase();
}

export async function uploadVideoFromBrowser(file: File): Promise<ClientVideoUploadResult> {
	if (file.size <= 0) {
		throw new Error("Empty file");
	}
	if (file.size > MAX_UPLOAD_BYTES) {
		throw new Error(`파일이 너무 큼. ${MAX_UPLOAD_MB}MB 이하 파일만 업로드 가능`);
	}

	const originalName = file.name.trim() || "video";
	const extension = getExtension(originalName);
	const objectPath = `uploads/${toMonthPath(new Date())}/${crypto.randomUUID()}.${extension}`;

	const blob = await upload(objectPath, file, {
		access: "public",
		handleUploadUrl: "/api/upload",
		clientPayload: JSON.stringify({
			originalName,
			mimeType: file.type,
			size: file.size,
		}),
	});

	return {
		success: true,
		type: "video",
		url: blob.url,
		originalName,
		mimeType: file.type,
		size: file.size,
		filename: objectPath,
	};
}
