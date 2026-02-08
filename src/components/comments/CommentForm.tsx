"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { Plus, Paperclip, BarChart3, HelpCircle, X } from "lucide-react";
import PollModal from "@/components/poll/PollModal";
import MarkdownHelpModal from "@/components/comments/MarkdownHelpModal";
import { serializePollData, PollData } from "@/lib/poll";
import { useToast } from "@/components/ui/useToast";

interface CommentFormProps {
	onSubmit: (content: string) => Promise<void> | void;
	disabled?: boolean;
	placeholder?: string;
	initialValue?: string;
	onCancel?: () => void;
	replyTo?: string;
	variant?: "composer" | "inline";
}

interface UploadPayload {
	type: "image" | "file";
	url: string;
	originalName: string;
	error?: string;
}

export default function CommentForm({
	onSubmit,
	disabled = false,
	placeholder = "댓글을 입력하세요...",
	initialValue = "",
	onCancel,
	replyTo,
	variant = "inline",
}: CommentFormProps) {
	const { showToast } = useToast();
	const [content, setContent] = useState(initialValue);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isPollModalOpen, setIsPollModalOpen] = useState(false);
	const [isSyntaxHelpOpen, setIsSyntaxHelpOpen] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isDragActive, setIsDragActive] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dragDepthRef = useRef(0);

	useEffect(() => {
		setContent(initialValue);
	}, [initialValue]);

	const appendUploadedContent = (payload: UploadPayload) => {
		const snippet =
			payload.type === "image"
				? `![${payload.originalName}](${payload.url})`
				: `[📦 ${payload.originalName}](${payload.url})`;
		setContent((prev) => prev + (prev ? "\n" : "") + snippet);
	};

	const uploadFiles = async (files: File[]) => {
		if (files.length === 0) return;

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
					const message = "error" in data ? data.error : "파일 업로드에 실패했습니다";
					throw new Error(message);
				}

				appendUploadedContent(data);
			}

			showToast({ type: "success", message: "파일 업로드 완료" });
			setIsMenuOpen(false);
		} catch (error) {
			console.error("Comment attachment upload error:", error);
			showToast({
				type: "error",
				message: error instanceof Error ? error.message : "파일 업로드에 실패했습니다",
			});
		} finally {
			setIsUploading(false);
		}
	};

	const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;
		await uploadFiles(Array.from(files));
		event.target.value = "";
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();

		if (!content.trim()) {
			showToast({ type: "error", message: "댓글 내용을 입력해줘" });
			return;
		}

		try {
			await onSubmit(content);
			setContent("");
		} catch (error) {
			console.error("Comment submit error:", error);
		}
	};

	const handlePollCreate = (pollData: PollData) => {
		const pollString = serializePollData(pollData);
		setContent((prev) => prev + (prev ? "\n" : "") + pollString);
		setIsPollModalOpen(false);
		setIsMenuOpen(false);
	};

	const handleDragEnter = (event: DragEvent<HTMLFormElement>) => {
		if (variant !== "composer") return;
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current += 1;
		setIsDragActive(true);
	};

	const handleDragLeave = (event: DragEvent<HTMLFormElement>) => {
		if (variant !== "composer") return;
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
		if (dragDepthRef.current === 0) {
			setIsDragActive(false);
		}
	};

	const handleDragOver = (event: DragEvent<HTMLFormElement>) => {
		if (variant !== "composer") return;
		event.preventDefault();
		event.stopPropagation();
	};

	const handleDrop = (event: DragEvent<HTMLFormElement>) => {
		if (variant !== "composer") return;
		event.preventDefault();
		event.stopPropagation();
		dragDepthRef.current = 0;
		setIsDragActive(false);
		const files = Array.from(event.dataTransfer.files ?? []);
		void uploadFiles(files);
	};

	return (
		<>
			<form
				onSubmit={handleSubmit}
				className={`comment-form ${variant} ${isDragActive ? "drag-active" : ""}`}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				{replyTo && (
					<div className="reply-bar">
						<span>
							<span className="reply-name">@{replyTo}</span>님에게 답장
						</span>
						{onCancel && (
							<button type="button" className="reply-cancel" onClick={onCancel}>
								<X size={14} />
							</button>
						)}
					</div>
				)}

				<div className="form-input-wrapper">
					<div className="plus-btn-wrapper">
						<button
							type="button"
							className={`plus-btn ${isMenuOpen ? "active" : ""}`}
							onClick={() => setIsMenuOpen((prev) => !prev)}
						>
							<Plus size={18} />
						</button>

						{isMenuOpen && (
							<div className="plus-menu">
								<button type="button" className="menu-item" onClick={() => fileInputRef.current?.click()}>
									<Paperclip size={16} />
									파일 첨부
								</button>
								<button type="button" className="menu-item" onClick={() => setIsPollModalOpen(true)}>
									<BarChart3 size={16} />
									투표 만들기
								</button>
								<button
									type="button"
									className="menu-item"
									onClick={() => {
										setIsSyntaxHelpOpen(true);
										setIsMenuOpen(false);
									}}
								>
									<HelpCircle size={16} />
									문법 도움말
								</button>
							</div>
						)}
					</div>

					<textarea
						value={content}
						onChange={(event) => setContent(event.target.value)}
						placeholder={placeholder}
						disabled={disabled}
						className="comment-textarea"
						rows={2}
						onFocus={() => setIsMenuOpen(false)}
					/>

					<button type="submit" disabled={disabled || isUploading || !content.trim()} className="submit-btn">
						{isUploading ? "업로드..." : disabled ? "..." : "전송"}
					</button>
				</div>

				{isDragActive && variant === "composer" && (
					<div className="drop-overlay">
						파일을 놓으면 바로 업로드됨
					</div>
				)}

				{onCancel && !replyTo && (
					<div className="cancel-wrapper">
						<button type="button" onClick={onCancel} disabled={disabled} className="btn btn-secondary btn-sm">
							취소
						</button>
					</div>
				)}

				<input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: "none" }} />
			</form>

			<PollModal isOpen={isPollModalOpen} onClose={() => setIsPollModalOpen(false)} onSubmit={handlePollCreate} />
			<MarkdownHelpModal isOpen={isSyntaxHelpOpen} onClose={() => setIsSyntaxHelpOpen(false)} />

			<style jsx>{`
				.comment-form {
					display: flex;
					flex-direction: column;
					gap: 8px;
					position: relative;
				}

				.comment-form.composer {
					padding: 10px 12px;
					background: var(--bg-secondary);
					border: 1px solid var(--border);
					border-radius: 10px;
					box-shadow: 0 -6px 18px rgba(0, 0, 0, 0.28);
				}

				.comment-form.inline {
					padding: 0;
					background: transparent;
					border: none;
				}

				.reply-bar {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 8px 12px;
					background: var(--bg-tertiary);
					border-radius: 6px;
					font-size: 0.85rem;
					color: var(--text-secondary);
				}

				.reply-name {
					color: var(--accent);
					font-weight: 600;
				}

				.reply-cancel {
					background: none;
					border: none;
					color: var(--text-muted);
					cursor: pointer;
					padding: 4px;
				}

				.reply-cancel:hover {
					color: var(--text-primary);
				}

				.form-input-wrapper {
					display: flex;
					align-items: stretch;
					gap: 8px;
				}

				.plus-btn-wrapper {
					position: relative;
					flex-shrink: 0;
				}

				.plus-btn {
					width: 42px;
					height: 42px;
					background: var(--bg-primary);
					border: 1px solid var(--border);
					border-radius: 999px;
					display: flex;
					align-items: center;
					justify-content: center;
					cursor: pointer;
					color: var(--text-muted);
					transition: all 0.2s;
				}

				.plus-btn:hover,
				.plus-btn.active {
					background: color-mix(in srgb, var(--accent) 65%, var(--bg-primary) 35%);
					border-color: var(--accent);
					color: white;
					transform: rotate(45deg);
				}

				.plus-menu {
					position: absolute;
					bottom: calc(100% + 8px);
					left: 0;
					background: var(--bg-primary);
					border: 1px solid var(--border);
					border-radius: 8px;
					padding: 4px;
					min-width: 170px;
					box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
					z-index: 40;
				}

				.menu-item {
					display: flex;
					align-items: center;
					gap: 8px;
					width: 100%;
					padding: 8px 12px;
					background: none;
					border: none;
					color: var(--text-secondary);
					font-size: 0.9rem;
					cursor: pointer;
					border-radius: 4px;
					text-align: left;
				}

				.menu-item:hover {
					background: var(--bg-tertiary);
					color: var(--text-primary);
				}

				.comment-textarea {
					flex: 1;
					padding: 10px 12px;
					background: var(--bg-tertiary);
					border: 1px solid var(--border);
					border-radius: 6px;
					color: var(--text-primary);
					font-size: 0.92rem;
					resize: none;
					min-height: 42px;
					max-height: 180px;
					overflow-y: auto;
				}

				.comment-form.composer .comment-textarea {
					background: #1f1c1a;
				}

				.comment-textarea:focus {
					outline: none;
					border-color: var(--accent);
				}

				.submit-btn {
					padding: 0 16px;
					min-height: 42px;
					background: var(--accent);
					border: none;
					border-radius: 6px;
					color: white;
					font-size: 0.9rem;
					font-weight: 600;
					cursor: pointer;
					white-space: nowrap;
				}

				.submit-btn:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				.submit-btn:not(:disabled):hover {
					background: var(--accent-hover);
				}

				.cancel-wrapper {
					text-align: right;
				}

				.drop-overlay {
					position: absolute;
					inset: 0;
					display: flex;
					align-items: center;
					justify-content: center;
					background: rgba(0, 0, 0, 0.55);
					border: 1px dashed var(--accent);
					border-radius: 10px;
					color: #fff;
					font-weight: 600;
					pointer-events: none;
				}

				@media (max-width: 640px) {
					.form-input-wrapper {
						gap: 6px;
					}

					.plus-btn {
						width: 38px;
						height: 38px;
					}

					.submit-btn {
						padding: 0 12px;
						min-height: 38px;
					}
				}
			`}</style>
		</>
	);
}
