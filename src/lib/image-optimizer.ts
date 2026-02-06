import sharp from "sharp";

export interface OptimizedImageResult {
	buffer: Buffer;
	width: number;
	height: number;
	mimeType: "image/webp";
	extension: "webp";
}

export async function optimizeImage(buffer: Buffer): Promise<OptimizedImageResult> {
	const resized = sharp(buffer).rotate().resize({
		width: 1920,
		withoutEnlargement: true,
	});

	const { data, info } = await resized
		.webp({ quality: 80 })
		.toBuffer({ resolveWithObject: true });

	return {
		buffer: data,
		width: info.width ?? 0,
		height: info.height ?? 0,
		mimeType: "image/webp",
		extension: "webp",
	};
}

export async function createThumbnail(
	buffer: Buffer,
	size: 150 | 300
): Promise<Buffer> {
	return sharp(buffer)
		.resize(size, size, { fit: "cover", position: "centre" })
		.webp({ quality: 80 })
		.toBuffer();
}

