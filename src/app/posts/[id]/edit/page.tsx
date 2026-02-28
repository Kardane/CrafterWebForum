"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FileImage, HelpCircle } from "lucide-react";
import ComposerPageLayout from "@/components/editor/ComposerPageLayout";
import MarkdownHelpModal from "@/components/comments/MarkdownHelpModal";
import { useToast } from "@/components/ui/useToast";
import { POST_TAGS } from "@/constants/post-tags";
import { toSessionUserId } from "@/lib/session-user";
import { parseUploadJsonResponse } from "@/lib/upload-response";
import { uploadVideoFromBrowser } from "@/lib/client-video-upload";

interface EditPostPageProps {
	params: Promise<{ id: string }>;
}

interface UploadPayload {
	success: boolean;
	type: "image" | "video" | "file";
	url: string;
	originalName: string;
	error?: string;
}

interface PostDetailPayload {
	post?: {
		id: number;
		title: string;
		content: string;
		tags: string[];
		author_id: number;
	};
	error?: string;
}

export default function EditPostPage({ params: paramsPromise }: EditPostPageProps) {
	const router = useRouter();
	const { data: session, status } = useSession();
	const { showToast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dragDepthRef = useRef(0);

	const [postId, setPostId] = useState<string | null>(null);
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isDragActive, setIsDragActive] = useState(false);
	const [isMarkdownHelpOpen, setIsMarkdownHelpOpen] = useState(false);

	useEffect(() => {
		let cancelled = false;

		const loadPost = async () => {
			if (status === "loading") {
				return;
			}

			const params = await paramsPromise;
			setPostId(params.id);

			if (status === "unauthenticated") {
				router.push(`/login?callbackUrl=${encodeURIComponent(`/posts/${params.id}/edit`)}`);
				return;
			}

			try {
				const response = await fetch(`/api/posts/${params.id}`, {
					cache: "no-store",
				});
				const payload = (await response.json()) as PostDetailPayload;

				if (!response.ok || !payload.post) {
					throw new Error(payload.error ?? "게시글 불러오기 실패");
				}

				const sessionUserId = toSessionUserId(session?.user?.id);
				if (!sessionUserId || payload.post.author_id !== sessionUserId) {
					showToast({ type: "error", message: "수정 권한이 없음" });
					router.push(`/posts/${params.id}`);
					return;
				}

				if (cancelled) {
					return;
				}

				setTitle(payload.post.title);
				setContent(payload.post.content);
				setSelectedTags(Array.isArray(payload.post.tags) ? payload.post.tags : []);
			} catch (error) {
				console.error("Edit post load error:", error);
				if (!cancelled) {
					showToast({ type: "error", message: "게시글을 불러오지 못함" });
					router.push("/");
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		};

		void loadPost();

		return () => {
			cancelled = true;
		};
	}, [paramsPromise, router, session?.user?.id, showToast, status]);

	const toggleTag = (tag: string) => {
		if (selectedTags.includes(tag)) {
			setSelectedTags((prev) => prev.filter((item) => item !== tag));
			return;
		}

		if (selectedTags.length >= 5) {
			showToast({ type: "error", message: "태그는 최대 5개까지 가능" });
			return;
		}

		setSelectedTags((prev) => [...prev, tag]);
	};

	const appendUploadedContent = (payload: UploadPayload) => {
		const snippet =
			payload.type === "image"
				? `![${payload.originalName}](${payload.url})`
				: payload.type === "video"
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
				if (file.type.startsWith("video/")) {
					const uploadedVideo = await uploadVideoFromBrowser(file);
					appendUploadedContent({
						success: true,
						type: "video",
						url: uploadedVideo.url,
						originalName: uploadedVideo.originalName,
					});
					continue;
				}

				const formData = new FormData();
				formData.append("file", file);

				const response = await fetch("/api/upload", {
					method: "POST",
					body: formData,
				});
				const parsed = await parseUploadJsonResponse<UploadPayload>(response);
				if (parsed.error || !parsed.data?.url) {
					throw new Error(parsed.error ?? "파일 업로드 실패");
				}

				appendUploadedContent(parsed.data);
			}
			showToast({ type: "success", message: "파일 업로드 완료" });
		} catch (error) {
			console.error("Edit post upload error:", error);
			showToast({
				type: "error",
				message: error instanceof Error ? error.message : "파일 업로드 실패",
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
		event.target.value = "";
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
			showToast({ type: "error", message: "제목과 내용을 입력해줘" });
			return;
		}

		if (!postId) {
			showToast({ type: "error", message: "게시글 ID를 찾지 못함" });
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await fetch(`/api/posts/${postId}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					title,
					content,
					tags: selectedTags,
				}),
			});

			const payload = (await response.json()) as { error?: string };
			if (!response.ok) {
				throw new Error(payload.error ?? "게시글 수정 실패");
			}

			showToast({ type: "success", message: "게시글 수정 완료" });
			router.push(`/posts/${postId}`);
		} catch (error) {
			console.error("Edit post submit error:", error);
			showToast({
				type: "error",
				message: error instanceof Error ? error.message : "게시글 수정 실패",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isLoading) {
		return (
			<ComposerPageLayout title="포스트 수정" description="기존 내용을 불러오는 중">
				<div className="flex min-h-[280px] items-center justify-center text-text-secondary">로딩 중...</div>
			</ComposerPageLayout>
		);
	}

	return (
		<ComposerPageLayout title="포스트 수정" description="기존 포스트를 새 포스트 작성 화면과 동일한 레이아웃에서 편집">
			<form
				onSubmit={handleSubmit}
				className={`relative flex flex-col gap-5 ${isDragActive ? "ring-2 ring-accent rounded-xl" : ""}`}
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
					<label htmlFor="title" className="text-sm font-semibold text-text-secondary">
						제목
					</label>
					<input
						id="title"
						type="text"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						className="input-base"
						placeholder="포스트 제목을 입력"
						maxLength={100}
						required
					/>
				</div>

				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<label className="text-sm font-semibold text-text-secondary">태그</label>
						<span className="text-xs text-text-muted">{selectedTags.length} / 5</span>
					</div>
					<div className="flex flex-wrap gap-2 rounded-lg border border-border bg-bg-tertiary/80 p-3">
						{POST_TAGS.map((tag) => {
							const isSelected = selectedTags.includes(tag);
							return (
								<button
									key={tag}
									type="button"
									onClick={() => toggleTag(tag)}
									className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
										isSelected
											? "border-accent bg-accent text-white"
											: "border-border bg-bg-secondary text-text-secondary hover:bg-bg-primary hover:text-text-primary"
									}`}
								>
									{tag}
								</button>
							);
						})}
					</div>
				</div>

				<div className="space-y-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<label htmlFor="content" className="text-sm font-semibold text-text-secondary">
							내용
						</label>
						<div className="flex flex-wrap items-center gap-2">
							<button
								type="button"
								onClick={() => setIsMarkdownHelpOpen(true)}
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
								{isUploading ? "업로드 중" : "파일 첨부"}
							</button>
						</div>
					</div>
					<textarea
						id="content"
						value={content}
						onChange={(event) => setContent(event.target.value)}
						className="input-base min-h-[360px] resize-y py-3 font-mono leading-relaxed"
						placeholder="내용을 입력해줘\n이미지/파일은 첨부하거나 드래그해서 올릴 수 있음"
						required
					/>
				</div>

				<div className="mt-1 flex items-center justify-end gap-2 border-t border-border pt-4">
					<button
						type="button"
						onClick={() => router.push(postId ? `/posts/${postId}` : "/")}
						className="btn btn-secondary"
					>
						취소
					</button>
					<button
						type="submit"
						disabled={isSubmitting || isUploading}
						className="btn btn-primary"
					>
						{isSubmitting ? "수정 중" : "수정 완료"}
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

			<MarkdownHelpModal isOpen={isMarkdownHelpOpen} onClose={() => setIsMarkdownHelpOpen(false)} />
		</ComposerPageLayout>
	);
}
