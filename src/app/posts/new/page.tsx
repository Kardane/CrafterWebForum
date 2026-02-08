"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FileImage, HelpCircle } from "lucide-react";
import ComposerPageLayout from "@/components/editor/ComposerPageLayout";
import MarkdownHelpModal from "@/components/comments/MarkdownHelpModal";
import { useToast } from "@/components/ui/useToast";
import { POST_TAGS } from "@/constants/post-tags";

interface UploadPayload {
	success: boolean;
	type: "image" | "file";
	url: string;
	originalName: string;
	error?: string;
}

export default function NewPostPage() {
	const router = useRouter();
	const { data: session } = useSession();
	const { showToast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isDragActive, setIsDragActive] = useState(false);
	const [isMarkdownHelpOpen, setIsMarkdownHelpOpen] = useState(false);

	const dragDepthRef = useRef(0);

	useEffect(() => {
		const savedTitle = localStorage.getItem("draft_post_title");
		const savedContent = localStorage.getItem("draft_post_content");
		const savedTags = localStorage.getItem("draft_post_tags");

		if (savedTitle) setTitle(savedTitle);
		if (savedContent) setContent(savedContent);
		if (savedTags) {
			try {
				const tags = JSON.parse(savedTags);
				if (Array.isArray(tags)) {
					setSelectedTags(tags.filter((tag): tag is string => typeof tag === "string"));
				}
			} catch (error) {
				console.error("Failed to parse saved draft tags:", error);
			}
		}
	}, []);

	useEffect(() => {
		localStorage.setItem("draft_post_title", title);
		localStorage.setItem("draft_post_content", content);
		localStorage.setItem("draft_post_tags", JSON.stringify(selectedTags));
	}, [title, content, selectedTags]);

	const clearDraft = () => {
		localStorage.removeItem("draft_post_title");
		localStorage.removeItem("draft_post_content");
		localStorage.removeItem("draft_post_tags");
	};

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
				const formData = new FormData();
				formData.append("file", file);

				const response = await fetch("/api/upload", {
					method: "POST",
					body: formData,
				});
				const data = (await response.json()) as UploadPayload | { error: string };

				if (!response.ok || !("url" in data)) {
					const message = "error" in data ? data.error : "파일 업로드 실패";
					throw new Error(message);
				}

				appendUploadedContent(data);
			}
			showToast({ type: "success", message: "파일 업로드 완료" });
		} catch (error) {
			console.error("Upload error:", error);
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

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		if (!title.trim() || !content.trim()) {
			showToast({ type: "error", message: "제목과 내용을 입력해줘" });
			return;
		}

		if (selectedTags.length === 0) {
			showToast({ type: "error", message: "태그를 최소 1개 선택해줘" });
			return;
		}

		if (!session?.user) {
			showToast({ type: "error", message: "로그인이 필요함" });
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await fetch("/api/posts", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					title,
					content,
					tags: selectedTags,
				}),
			});

			const data = (await response.json()) as { postId?: number; error?: string };
			if (!response.ok || !data.postId) {
				throw new Error(data.error || "포스트 생성 실패");
			}

			clearDraft();
			showToast({ type: "success", message: "포스트 작성 완료" });
			router.push(`/posts/${data.postId}`);
		} catch (error) {
			console.error("Post creation error:", error);
			showToast({
				type: "error",
				message: error instanceof Error ? error.message : "포스트 작성 실패",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<ComposerPageLayout
			title="새 포스트 작성"
			description="드래그 앤 드롭 또는 첨부 버튼으로 파일을 올리고 마크다운으로 내용을 작성"
		>
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
						onClick={() => router.push("/")}
						className="btn btn-secondary"
					>
						취소
					</button>
					<button
						type="submit"
						disabled={isSubmitting || isUploading}
						className="btn btn-primary"
					>
						{isSubmitting ? "작성 중" : "포스트 등록"}
					</button>
				</div>

				<input
					ref={fileInputRef}
					type="file"
					className="hidden"
					onChange={handleFileSelect}
					multiple
				/>
			</form>

			<MarkdownHelpModal
				isOpen={isMarkdownHelpOpen}
				onClose={() => setIsMarkdownHelpOpen(false)}
			/>
		</ComposerPageLayout>
	);
}
