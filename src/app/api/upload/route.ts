import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { optimizeImage } from "@/lib/image-optimizer";
import { enqueueImageThumbnailJob } from "@/lib/upload-postprocess-queue";
import {
	VIDEO_UPLOAD_MIME_TYPES,
	IMAGE_UPLOAD_MIME_TYPES,
	createStoredFileName,
	getUploadRelativeDir,
	toBlobObjectPath,
	UploadValidationError,
	validateUploadFile,
	validateUploadMetadata,
} from "@/lib/upload";
import { MAX_UPLOAD_BYTES } from "@/lib/upload-constants";
import { resolveActiveUserFromSession } from "@/lib/active-user";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";


export const runtime = "nodejs";

function getBlobToken(): string {
	const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
	if (!token) {
		throw new UploadValidationError("Upload storage unavailable", 503);
	}
	return token;
}

interface UploadSuccessResponse {
	success: true;
	type: "image" | "video" | "file";
	url: string;
	filename: string;
	originalName: string;
	mimeType: string;
	size: number;
	thumb150Url?: string;
	thumb300Url?: string;
	width?: number;
	height?: number;
}

export async function POST(request: Request) {
	const contentType = request.headers.get("content-type") ?? "";
	if (contentType.includes("application/json")) {
		try {
			const body = (await readJsonBody(request, { maxBytes: 256 * 1024 })) as HandleUploadBody;
			const response = await handleUpload({
				request,
				body,
				token: getBlobToken(),
				onBeforeGenerateToken: async (_pathname, clientPayload) => {
					const session = await auth();
					const activeUser = await resolveActiveUserFromSession(session);
					if (!activeUser.ok) {
						throw new Error(activeUser.error);
					}
					const userId = activeUser.context.userId;

					const parsedPayload = (() => {
						if (!clientPayload) {
							throw new Error("Missing upload payload");
						}
						try {
							return JSON.parse(clientPayload) as {
								originalName?: string;
								mimeType?: string;
								size?: number;
							};
						} catch {
							throw new Error("Invalid upload payload");
						}
					})();

					const validated = validateUploadMetadata({
						originalName: parsedPayload.originalName ?? "video",
						mimeType: parsedPayload.mimeType ?? "",
						size: typeof parsedPayload.size === "number" ? parsedPayload.size : -1,
					});

					if (validated.kind !== "video" && validated.kind !== "image") {
						throw new Error("Only image/video client uploads are supported");
					}

					const allowedContentTypes =
						validated.kind === "video"
							? [...VIDEO_UPLOAD_MIME_TYPES]
							: [...IMAGE_UPLOAD_MIME_TYPES];

					return {
						allowedContentTypes,
						maximumSizeInBytes: MAX_UPLOAD_BYTES,
						addRandomSuffix: false,
						tokenPayload: JSON.stringify({
							userId,
							originalName: validated.originalName,
							mimeType: validated.mimeType,
							size: validated.size,
						}),
					};
				},
				onUploadCompleted: async ({ blob, tokenPayload }) => {
					if (!tokenPayload) {
						return;
					}
					const parsed = JSON.parse(tokenPayload) as {
						userId?: number;
						originalName?: string;
						mimeType?: string;
						size?: number;
					};
					if (!parsed.userId || !parsed.originalName || !parsed.mimeType || typeof parsed.size !== "number") {
						return;
					}
					await prisma.upload.create({
						data: {
							filename: blob.url,
							originalName: parsed.originalName,
							mimetype: parsed.mimeType,
							size: parsed.size,
						},
					});
				},
			});
			return NextResponse.json(response);
		} catch (error) {
			if (error instanceof JsonBodyError) {
				return NextResponse.json({ error: error.code }, { status: error.status });
			}
			if (error instanceof UploadValidationError) {
				return NextResponse.json({ error: error.message }, { status: error.status });
			}
			const message = error instanceof Error ? error.message : "Upload failed";
			const status =
				message === "Unauthorized" || message === "unauthorized"
					? 401
					: message === "pending_approval" || message === "banned_user"
						? 403
						: 400;
			return NextResponse.json({ error: message }, { status });
		}
	}

	try {
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session);
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}

		const formData = await request.formData();
		const fileValue = formData.get("file");
		if (!(fileValue instanceof File)) {
			return NextResponse.json({ error: "Missing file field" }, { status: 400 });
		}

		const validated = validateUploadFile(fileValue);
		const inputBuffer = Buffer.from(await fileValue.arrayBuffer());
		const uploadRelativeDir = getUploadRelativeDir();
		const blobToken = getBlobToken();

		if (validated.kind === "image") {
			const isGif = validated.extension === "gif";
			const baseName = createStoredFileName(
				isGif ? validated.extension : "webp"
			).replace(/\.[^.]+$/, "");
			const mainFilename = isGif
				? `${baseName}.${validated.extension}`
				: `${baseName}.webp`;

			const optimized = isGif ? null : await optimizeImage(inputBuffer);
			const mainBuffer = optimized ? optimized.buffer : inputBuffer;
			const mainMimeType = optimized ? optimized.mimeType : validated.mimeType;

			const mainObjectPath = toBlobObjectPath(uploadRelativeDir, mainFilename);
			const mainBlob = await put(mainObjectPath, mainBuffer, {
				access: "public",
				addRandomSuffix: false,
				contentType: mainMimeType,
				token: blobToken,
			});
			enqueueImageThumbnailJob({
				uploadRelativeDir,
				baseName,
				mainBuffer,
				blobToken,
			});

			await prisma.upload.create({
				data: {
					filename: mainBlob.url,
					originalName: validated.originalName,
					mimetype: mainMimeType,
					size: mainBuffer.byteLength,
				},
			});

			const payload: UploadSuccessResponse = {
				success: true,
				type: "image",
				url: mainBlob.url,
				filename: mainFilename,
				originalName: validated.originalName,
				mimeType: mainMimeType,
				size: mainBuffer.byteLength,
				width: optimized?.width,
				height: optimized?.height,
			};
			return NextResponse.json(payload);
		}

		const storedName = createStoredFileName(validated.extension);
		const objectPath = toBlobObjectPath(uploadRelativeDir, storedName);
		const uploadedBlob = await put(objectPath, inputBuffer, {
			access: "public",
			addRandomSuffix: false,
			contentType: validated.mimeType,
			token: blobToken,
		});

		await prisma.upload.create({
			data: {
				filename: uploadedBlob.url,
				originalName: validated.originalName,
				mimetype: validated.mimeType,
				size: inputBuffer.byteLength,
			},
		});

		const payload: UploadSuccessResponse = {
			success: true,
			type: validated.kind,
			url: uploadedBlob.url,
			filename: storedName,
			originalName: validated.originalName,
			mimeType: validated.mimeType,
			size: inputBuffer.byteLength,
		};
		return NextResponse.json(payload);
	} catch (error) {
		if (error instanceof UploadValidationError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}

		console.error("[API] POST /api/upload error:", error);
		return NextResponse.json({ error: "Upload failed" }, { status: 500 });
	}
}
