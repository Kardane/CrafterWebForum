import path from "node:path";
import { unlink, writeFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createThumbnail, optimizeImage } from "@/lib/image-optimizer";
import {
	createStoredFileName,
	ensureUploadPath,
	toPublicUploadUrl,
	UploadValidationError,
	validateUploadFile,
} from "@/lib/upload";


export const runtime = "nodejs";

interface UploadSuccessResponse {
	success: true;
	type: "image" | "file";
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
	const createdFiles: string[] = [];
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const formData = await request.formData();
		const fileValue = formData.get("file");
		if (!(fileValue instanceof File)) {
			return NextResponse.json({ error: "Missing file field" }, { status: 400 });
		}

		const validated = validateUploadFile(fileValue);
		const uploadPath = await ensureUploadPath();
		const inputBuffer = Buffer.from(await fileValue.arrayBuffer());

		if (validated.kind === "image") {
			const isGif = validated.extension === "gif";
			const baseName = createStoredFileName(
				isGif ? validated.extension : "webp"
			).replace(/\.[^.]+$/, "");
			const mainFilename = isGif
				? `${baseName}.${validated.extension}`
				: `${baseName}.webp`;
			const thumb150Filename = `${baseName}-150.webp`;
			const thumb300Filename = `${baseName}-300.webp`;

			const mainAbsolutePath = path.join(uploadPath.absoluteDir, mainFilename);
			const thumb150AbsolutePath = path.join(uploadPath.absoluteDir, thumb150Filename);
			const thumb300AbsolutePath = path.join(uploadPath.absoluteDir, thumb300Filename);

			const optimized = isGif ? null : await optimizeImage(inputBuffer);
			const mainBuffer = optimized ? optimized.buffer : inputBuffer;
			const mainMimeType = optimized ? optimized.mimeType : validated.mimeType;

			const thumb150 = await createThumbnail(mainBuffer, 150);
			const thumb300 = await createThumbnail(mainBuffer, 300);

			await writeFile(mainAbsolutePath, mainBuffer);
			createdFiles.push(mainAbsolutePath);
			await writeFile(thumb150AbsolutePath, thumb150);
			createdFiles.push(thumb150AbsolutePath);
			await writeFile(thumb300AbsolutePath, thumb300);
			createdFiles.push(thumb300AbsolutePath);

			const relativeMain = path.join(uploadPath.relativeDir, mainFilename);
			const relative150 = path.join(uploadPath.relativeDir, thumb150Filename);
			const relative300 = path.join(uploadPath.relativeDir, thumb300Filename);

			await prisma.upload.create({
				data: {
					filename: relativeMain.replace(/\\/g, "/"),
					originalName: validated.originalName,
					mimetype: mainMimeType,
					size: mainBuffer.byteLength,
				},
			});

			const payload: UploadSuccessResponse = {
				success: true,
				type: "image",
				url: toPublicUploadUrl(relativeMain),
				filename: mainFilename,
				originalName: validated.originalName,
				mimeType: mainMimeType,
				size: mainBuffer.byteLength,
				thumb150Url: toPublicUploadUrl(relative150),
				thumb300Url: toPublicUploadUrl(relative300),
				width: optimized?.width,
				height: optimized?.height,
			};
			return NextResponse.json(payload);
		}

		const storedName = createStoredFileName(validated.extension);
		const absolutePath = path.join(uploadPath.absoluteDir, storedName);
		await writeFile(absolutePath, inputBuffer);
		createdFiles.push(absolutePath);

		const relativePath = path.join(uploadPath.relativeDir, storedName);
		await prisma.upload.create({
			data: {
				filename: relativePath.replace(/\\/g, "/"),
				originalName: validated.originalName,
				mimetype: validated.mimeType,
				size: inputBuffer.byteLength,
			},
		});

		const payload: UploadSuccessResponse = {
			success: true,
			type: validated.kind,
			url: toPublicUploadUrl(relativePath),
			filename: storedName,
			originalName: validated.originalName,
			mimeType: validated.mimeType,
			size: inputBuffer.byteLength,
		};
		return NextResponse.json(payload);
	} catch (error) {
		for (const filePath of createdFiles) {
			try {
				await unlink(filePath);
			} catch {
				// Keep cleanup best-effort; failures here should not mask the original error.
			}
		}

		if (error instanceof UploadValidationError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}

		console.error("[API] POST /api/upload error:", error);
		return NextResponse.json({ error: "Upload failed" }, { status: 500 });
	}
}
