"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { FileImage, HelpCircle } from "lucide-react";
import ComposerPageLayout from "@/components/editor/ComposerPageLayout";
import MarkdownHelpModal from "@/components/comments/MarkdownHelpModal";
import { useToast } from "@/components/ui/useToast";
import { parseUploadJsonResponse } from "@/lib/upload-response";
import { uploadImageFromBrowser, uploadVideoFromBrowser } from "@/lib/client-video-upload";

interface UploadPayload {
	success: boolean;
	type: "image" | "video" | "file";
	url: string;
	originalName: string;
	error?: string;
}

	export default function NewSinmungoPostPage() {
	const router = useRouter();
	const { data: session } = useSession();
	const { showToast } = useToast();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dragDepthRef = useRef(0);

	const [title, setTitle] = useState("");
	const [serverAddress, setServerAddress] = useState("");
	const [content, setContent] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isDragActive, setIsDragActive] = useState(false);
	const [isMarkdownHelpOpen, setIsMarkdownHelpOpen] = useState(false);

	useEffect(() => {
		if (session?.user && session.user.isApproved !== 1) {
			showToast({ type: "error", message: "신문고 작성은 관리자 승인 후 가능함" });
			router.replace("/?toast=approval-required");
		}
	}, [router, session, showToast]);

	useEffect(() => {
		const savedTitle = localStorage.getItem("draft_sinmungo_title");
		const savedContent = localStorage.getItem("draft_sinmungo_content");
		const savedServerAddress = localStorage.getItem("draft_sinmungo_server_address");
		if (savedTitle) setTitle(savedTitle);
		if (savedContent) setContent(savedContent);
		if (savedServerAddress) setServerAddress(savedServerAddress);
	}, []);

	useEffect(() => {
		localStorage.setItem("draft_sinmungo_title", title);
		localStorage.setItem("draft_sinmungo_content", content);
		localStorage.setItem("draft_sinmungo_server_address", serverAddress);
	}, [title, content, serverAddress]);

	const clearDraft = () => {
		localStorage.removeItem("draft_sinmungo_title");
		localStorage.removeItem("draft_sinmungo_content");
		localStorage.removeItem("draft_sinmungo_server_address");
	};

	const appendUploadedContent = (payload: UploadPayload) => {
		const snippet =
			payload.type === "image"
				? `![${payload.originalName}](${payload.url})`
				: payload.type === "video"
					? payload.url
					: `[📦 ${payload.originalName}](${payload.url})`;

		setContent((prev) => (!prev.trim() ? snippet : `${prev}\n${snippet}`));
	};

	const uploadFiles = async (files: File[]) => {
		if (files.length === 0) return;
		setIsUploading(true);
		try {
			for (const file of files) {
				if (file.type.startsWith("image/")) {
					const uploadedImage = await uploadImageFromBrowser(file);
					appendUploadedContent({ success: true, type: "image", url: uploadedImage.url, originalName: uploadedImage.originalName });
					continue;
				}
				if (file.type.startsWith("video/")) {
					const uploadedVideo = await uploadVideoFromBrowser(file);
					appendUploadedContent({ success: true, type: "video", url: uploadedVideo.url, originalName: uploadedVideo.originalName });
					continue;
				}

				const formData = new FormData();
				formData.append("file", file);
				const response = await fetch("/api/upload", { method: "POST", body: formData });
				const parsed = await parseUploadJsonResponse<UploadPayload>(response);
				if (parsed.error || !parsed.data?.url) {
					throw new Error(parsed.error ?? "파일 업로드 실패");
				}
				appendUploadedContent(parsed.data);
			}
			showToast({ type: "success", message: "파일 업로드 완료" });
		} catch (error) {
			console.error("Upload error:", error);
			showToast({ type: "error", message: error instanceof Error ? error.message : "파일 업로드 실패" });
		} finally {
			setIsUploading(false);
		}
	};

	const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;
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
		if (dragDepthRef.current === 0) setIsDragActive(false);
	};

	const handleDrop = (event: DragEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current = 0;
		setIsDragActive(false);
		void uploadFiles(Array.from(event.dataTransfer.files ?? []));
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!title.trim() || !content.trim() || !serverAddress.trim()) {
			showToast({ type: "error", message: "제목, 서버 주소, 내용을 입력해줘" });
			return;
		}
		if (!session?.user) {
			showToast({ type: "error", message: "로그인이 필요함" });
			return;
		}
		if (session.user.isApproved !== 1) {
			showToast({ type: "error", message: "신문고 작성은 관리자 승인 후 가능함" });
			router.replace("/?toast=approval-required");
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await fetch("/api/posts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title,
					content,
					board: "sinmungo",
					serverAddress: serverAddress.trim(),
					tags: [],
				}),
			});

			const data = (await response.json()) as { postId?: number; error?: string };
			if (!response.ok || !data.postId) {
				throw new Error(data.error || "신문고 작성 실패");
			}

			clearDraft();
			showToast({ type: "success", message: "신문고 작성 완료" });
			router.push(`/posts/${data.postId}`);
		} catch (error) {
			console.error("Sinmungo creation error:", error);
			showToast({ type: "error", message: error instanceof Error ? error.message : "신문고 작성 실패" });
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<ComposerPageLayout
			title="서버 신문고 작성"
			description="운영 서버 이슈를 남길 수 있는 제보 글 작성"
			backHref="/sinmungo"
		>
			<form
				onSubmit={handleSubmit}
				className={`relative flex flex-col gap-5 ${isDragActive ? "ring-2 ring-accent rounded-xl" : ""}`}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={(event) => {
					event.preventDefault();
					event.stopPropagation();
				}}
				onDrop={handleDrop}
			>
				{isDragActive && (
					<div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-accent bg-black/55 backdrop-blur-sm">
						<div className="flex items-center gap-2 text-sm font-semibold text-white">
							<FileImage size={18} /> 파일을 놓으면 바로 업로드됨
						</div>
					</div>
				)}

				<div className="space-y-2">
					<label htmlFor="title" className="text-sm font-semibold text-text-secondary">제목</label>
					<input id="title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} className="input-base" placeholder="신문고 제목을 입력" maxLength={100} required />
				</div>

				<div className="space-y-2">
					<label htmlFor="serverAddress" className="text-sm font-semibold text-text-secondary">서버 주소</label>
					<input id="serverAddress" type="text" value={serverAddress} onChange={(event) => setServerAddress(event.target.value)} className="input-base" placeholder="mc.example.com:25565" required />
				</div>

				<div className="space-y-2">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<label htmlFor="content" className="text-sm font-semibold text-text-secondary">내용</label>
						<div className="flex flex-wrap items-center gap-2">
							<button type="button" onClick={() => setIsMarkdownHelpOpen(true)} className="btn btn-secondary btn-sm">
								<HelpCircle size={14} /> 마크다운 가이드
							</button>
							<button type="button" onClick={() => fileInputRef.current?.click()} className="btn btn-secondary btn-sm" disabled={isUploading}>
								<FileImage size={14} /> {isUploading ? "업로드 중" : "파일 첨부"}
							</button>
						</div>
					</div>
					<textarea id="content" value={content} onChange={(event) => setContent(event.target.value)} className="input-base min-h-[360px] resize-y py-3 font-mono leading-relaxed" placeholder="운영 서버에서 발생한 문제를 구체적으로 남겨줘" required />
				</div>

				<div className="mt-1 flex items-center justify-end gap-2 border-t border-border pt-4">
					<button type="button" onClick={() => router.push("/sinmungo")} className="btn btn-secondary">취소</button>
					<button type="submit" disabled={isSubmitting || isUploading} className="btn btn-primary">
						{isSubmitting ? "작성 중" : "신문고 등록"}
					</button>
				</div>

				<input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.pdf,.txt,.md,.json,.zip" multiple />
			</form>

			<MarkdownHelpModal isOpen={isMarkdownHelpOpen} onClose={() => setIsMarkdownHelpOpen(false)} />
		</ComposerPageLayout>
	);
}
