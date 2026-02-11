"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

export interface UploadedFileResult {
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

interface FileUploaderProps {
	onUploaded?: (result: UploadedFileResult) => void;
	accept?: string;
	maxSizeMB?: number;
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUploader({
	onUploaded,
	accept = ".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.pdf,.txt,.md,.json,.zip",
	maxSizeMB = 5,
}: FileUploaderProps) {
	const [isDragging, setIsDragging] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [items, setItems] = useState<UploadedFileResult[]>([]);

	const maxBytes = useMemo(() => maxSizeMB * 1024 * 1024, [maxSizeMB]);

	const uploadWithProgress = (file: File): Promise<UploadedFileResult> =>
		new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			const formData = new FormData();
			formData.append("file", file);

			xhr.open("POST", "/api/upload");
			xhr.responseType = "json";

			xhr.upload.onprogress = (event) => {
				if (!event.lengthComputable) return;
				const next = Math.round((event.loaded / event.total) * 100);
				setProgress(next);
			};

			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) {
					resolve(xhr.response as UploadedFileResult);
					return;
				}
				const message =
					(xhr.response as { error?: string } | null)?.error ?? "Upload failed";
				reject(new Error(message));
			};

			xhr.onerror = () => reject(new Error("Network error during upload"));
			xhr.send(formData);
		});

	const handleFiles = async (fileList: FileList | File[]) => {
		const files = Array.from(fileList);
		if (files.length === 0) return;

		setError(null);
		setIsUploading(true);
		setProgress(0);

		try {
			for (const file of files) {
				if (file.size > maxBytes) {
					throw new Error(`"${file.name}" exceeds ${maxSizeMB}MB limit.`);
				}
				const result = await uploadWithProgress(file);
				setItems((prev) => [result, ...prev]);
				onUploaded?.(result);
			}
		} catch (e) {
			console.error(e);
			setError((e as Error).message);
		} finally {
			setIsUploading(false);
			setProgress(0);
		}
	};

	const copyUrl = async (url: string) => {
		try {
			await navigator.clipboard.writeText(url);
		} catch (e) {
			console.error(e);
			setError("Failed to copy URL.");
		}
	};

	return (
		<div className="space-y-3">
			<div
				className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
					isDragging ? "border-accent bg-bg-tertiary/50" : "border-border"
				}`}
				onDragOver={(e) => {
					e.preventDefault();
					setIsDragging(true);
				}}
				onDragLeave={() => setIsDragging(false)}
				onDrop={(e) => {
					e.preventDefault();
					setIsDragging(false);
					void handleFiles(e.dataTransfer.files);
				}}
			>
				<p className="text-sm text-text-secondary mb-2">
					Drag files here or select files
				</p>
				<p className="text-xs text-text-muted mb-3">
					Max {maxSizeMB}MB per file. Allowed: images/videos + pdf/txt/md/json/zip.
				</p>
				<label className="btn btn-secondary cursor-pointer">
					Choose Files
					<input
						type="file"
						accept={accept}
						multiple
						className="hidden"
						onChange={(e) => {
							if (!e.target.files) return;
							void handleFiles(e.target.files);
							e.target.value = "";
						}}
					/>
				</label>
			</div>

			{isUploading && (
				<div className="text-sm">
					<div className="w-full h-2 bg-bg-tertiary rounded overflow-hidden">
						<div
							className="h-full bg-accent transition-all"
							style={{ width: `${progress}%` }}
						/>
					</div>
					<p className="mt-1 text-text-muted">Uploading... {progress}%</p>
				</div>
			)}

			{error && <p className="text-sm text-error">{error}</p>}

			{items.length > 0 && (
				<div className="space-y-2">
					{items.map((item) => (
						<div
							key={`${item.filename}-${item.size}`}
							className="border border-border rounded p-3 bg-bg-tertiary/30"
						>
							<div className="flex items-center justify-between gap-2">
								<div className="min-w-0">
									<p className="text-sm font-medium truncate">{item.originalName}</p>
									<p className="text-xs text-text-muted">
										{item.mimeType} - {formatBytes(item.size)}
									</p>
								</div>
								<button
									type="button"
									className="btn btn-secondary btn-sm"
									onClick={() => {
										void copyUrl(item.url);
									}}
								>
									Copy URL
								</button>
							</div>
							{item.type === "image" && (
								<div className="mt-2">
									<Image
										src={item.thumb150Url ?? item.url}
										alt={item.originalName}
										width={120}
										height={120}
										className="w-[120px] h-[120px] object-cover rounded border border-border"
									/>
								</div>
							)}
							<p className="mt-2 text-xs text-text-muted break-all">{item.url}</p>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
