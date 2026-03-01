'use client';

import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FileImage, HelpCircle } from 'lucide-react';
import MarkdownHelpModal from '@/components/comments/MarkdownHelpModal';
import { useToast } from '@/components/ui/useToast';
import { parseUploadJsonResponse } from '@/lib/upload-response';
import { uploadImageFromBrowser, uploadVideoFromBrowser } from '@/lib/client-video-upload';

interface UploadPayload {
	success: boolean;
	type: 'image' | 'video' | 'file';
	url: string;
	originalName: string;
	error?: string;
}

export default function InquiryForm() {
	const router = useRouter();
	const { showToast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dragDepthRef = useRef(0);

	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isDragActive, setIsDragActive] = useState(false);
	const [isHelpOpen, setIsHelpOpen] = useState(false);

	const appendUploadedContent = (payload: UploadPayload) => {
		const snippet =
			payload.type === 'image'
				? `![${payload.originalName}](${payload.url})`
				: payload.type === 'video'
					? payload.url
					: `[📦 ${payload.originalName}](${payload.url})`;

		setContent((prev) => {
			if (!prev.trim()) {
				return snippet;
			}
			return `${prev}\n${snippet}`;
		});
	};

	const uploadFiles = async (files: File[]) => {
		if (files.length === 0) {
			return;
		}

		setIsUploading(true);
		try {
			for (const file of files) {
				if (file.type.startsWith('image/')) {
					const uploadedImage = await uploadImageFromBrowser(file);
					appendUploadedContent({
						success: true,
						type: 'image',
						url: uploadedImage.url,
						originalName: uploadedImage.originalName,
					});
					continue;
				}
				if (file.type.startsWith('video/')) {
					const uploadedVideo = await uploadVideoFromBrowser(file);
					appendUploadedContent({
						success: true,
						type: 'video',
						url: uploadedVideo.url,
						originalName: uploadedVideo.originalName,
					});
					continue;
				}

				const formData = new FormData();
				formData.append('file', file);

				const response = await fetch('/api/upload', {
					method: 'POST',
					body: formData,
				});
				const parsed = await parseUploadJsonResponse<UploadPayload>(response);
				if (parsed.error || !parsed.data?.url) {
					throw new Error(parsed.error ?? '파일 업로드 실패');
				}
				appendUploadedContent(parsed.data);
			}
			showToast({ type: 'success', message: '파일 업로드 완료' });
		} catch (error) {
			console.error('Inquiry upload error:', error);
			showToast({
				type: 'error',
				message: error instanceof Error ? error.message : '파일 업로드 실패',
			});
		} finally {
			setIsUploading(false);
		}
	};

	const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) {
			return;
		}

		await uploadFiles(Array.from(files));
		event.target.value = '';
	};

	const handleDragEnter = (event: DragEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current += 1;
		setIsDragActive(true);
	};

	const handleDragLeave = (event: DragEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
		if (dragDepthRef.current === 0) {
			setIsDragActive(false);
		}
	};

	const handleDragOver = (event: DragEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
	};

	const handleDrop = (event: DragEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current = 0;
		setIsDragActive(false);
		const files = Array.from(event.dataTransfer.files ?? []);
		void uploadFiles(files);
	};

	const handleSubmit = async (event: FormEvent) => {
		event.preventDefault();
		if (!title.trim() || !content.trim()) {
			showToast({ type: 'error', message: '제목과 내용을 입력해줘' });
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await fetch('/api/inquiries', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title, content }),
			});

			const data = (await response.json()) as { inquiryId?: number; error?: string };
			if (!response.ok || !data.inquiryId) {
				throw new Error(data.error || '문의 작성 실패');
			}

			showToast({ type: 'success', message: '문의 작성 완료' });
			router.push(`/inquiries/${data.inquiryId}`);
			router.refresh();
		} catch (error) {
			console.error('Inquiry submit error:', error);
			showToast({
				type: 'error',
				message: error instanceof Error ? error.message : '문의 작성 실패',
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<form
				onSubmit={handleSubmit}
				className={`relative flex flex-col gap-5 ${isDragActive ? 'ring-2 ring-accent rounded-xl' : ''}`}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				{isDragActive && (
					<div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-black/55 backdrop-blur-sm">
						<div className="flex items-center gap-2 text-sm font-semibold text-white">
							<FileImage size={18} />
							파일을 놓으면 바로 업로드됨
						</div>
					</div>
				)}

				<div className="space-y-2">
					<label htmlFor="inquiry-title" className="text-sm font-semibold text-text-secondary">
						제목
					</label>
					<input
						id="inquiry-title"
						type="text"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						className="input-base"
						maxLength={100}
						placeholder="문의 제목을 입력"
						required
					/>
				</div>

				<div className="space-y-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<label htmlFor="inquiry-content" className="text-sm font-semibold text-text-secondary">
							내용
						</label>
						<div className="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={() => setIsHelpOpen(true)}
								className="btn btn-secondary btn-sm"
							>
								<HelpCircle size={14} />
								마크다운 가이드
							</button>
							<button
								type="button"
								onClick={() => fileInputRef.current?.click()}
								className="btn btn-secondary btn-sm"
								disabled={isUploading}
							>
								<FileImage size={14} />
								{isUploading ? '업로드 중' : '파일 첨부'}
							</button>
						</div>
					</div>
					<textarea
						id="inquiry-content"
						value={content}
						onChange={(event) => setContent(event.target.value)}
						className="input-base min-h-[280px] resize-y py-3 font-mono leading-relaxed"
						placeholder="문의 내용을 입력해줘"
						required
					/>
				</div>

				<div className="mt-1 flex items-center justify-end gap-2 border-t border-border pt-4">
					<button type="button" onClick={() => router.back()} className="btn btn-secondary">
						취소
					</button>
					<button type="submit" disabled={isSubmitting || isUploading} className="btn btn-primary">
						{isSubmitting ? '작성 중' : '문의 작성'}
					</button>
				</div>

				<input
					ref={fileInputRef}
					type="file"
					className="hidden"
					onChange={handleFileSelect}
					accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.pdf,.txt,.md,.json,.zip"
					multiple
				/>
			</form>

			<MarkdownHelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
		</>
	);
}
