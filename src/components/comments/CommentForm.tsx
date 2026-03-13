"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { Plus, Paperclip, BarChart3, HelpCircle, X } from "lucide-react";
import PollModal from "@/components/poll/PollModal";
import MarkdownHelpModal from "@/components/comments/MarkdownHelpModal";
import { serializePollData, PollData } from "@/lib/poll";
import { useToast } from "@/components/ui/useToast";
import { parseUploadJsonResponse } from "@/lib/upload-response";
import { uploadImageFromBrowser, uploadVideoFromBrowser } from "@/lib/client-video-upload";
import { text } from "@/lib/system-text";

interface CommentFormProps {
	onSubmit: (content: string) => Promise<void> | void;
	onTypingStateChange?: (typing: boolean) => void;
	onRequestEditLatestOwnComment?: () => void;
	disabled?: boolean;
	placeholder?: string;
	initialValue?: string;
	onCancel?: () => void;
	replyTo?: string;
	replyPreview?: string;
	variant?: "composer" | "inline";
	textareaId?: string;
	mode?: "create" | "edit";
	postId?: number;
}

interface UploadPayload {
	type: "image" | "video" | "file";
	url: string;
	originalName: string;
	error?: string;
}

export default function CommentForm({
	onSubmit,
	onTypingStateChange,
	onRequestEditLatestOwnComment,
	disabled = false,
	placeholder = "댓글을 입력하세요...",
	initialValue = "",
	onCancel,
	replyTo,
	replyPreview,
	variant = "inline",
	textareaId,
	mode = "create",
	postId,
}: CommentFormProps) {
	const { showToast } = useToast();
	const [content, setContent] = useState(initialValue);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isPollModalOpen, setIsPollModalOpen] = useState(false);
	const [isSyntaxHelpOpen, setIsSyntaxHelpOpen] = useState(false);
	const [isUploading, setIsUploading] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isDragActive, setIsDragActive] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const dragDepthRef = useRef(0);
	const isUserResizedRef = useRef(false);
	const resizeStartHeightRef = useRef<number | null>(null);
	const resizeDragCleanupRef = useRef<(() => void) | null>(null);
	const isEditMode = mode === "edit";
	const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		setContent(initialValue);
	}, [initialValue]);

	useEffect(() => {
		if (!onTypingStateChange || isEditMode) {
			return;
		}
		onTypingStateChange(content.trim().length > 0);
		if (typingTimerRef.current) {
			clearTimeout(typingTimerRef.current);
		}
		typingTimerRef.current = setTimeout(() => {
			onTypingStateChange(false);
		}, 2000);
		return () => {
			if (typingTimerRef.current) {
				clearTimeout(typingTimerRef.current);
				typingTimerRef.current = null;
			}
		};
	}, [content, isEditMode, onTypingStateChange]);

	// 임시 저장 불러오기
	useEffect(() => {
		if (postId && !isEditMode && !initialValue) {
			const saved = localStorage.getItem(`comment_draft_${postId}`);
			if (saved) {
				setContent(saved);
			}
		}
	}, [postId, isEditMode, initialValue]);

	// 임시 저장 (디바운스 없이 즉시 저장)
	useEffect(() => {
		if (postId && !isEditMode && content && content !== initialValue) {
			localStorage.setItem(`comment_draft_${postId}`, content);
		} else if (postId && !isEditMode && !content) {
			localStorage.removeItem(`comment_draft_${postId}`);
		}
	}, [content, postId, isEditMode, initialValue]);

	useEffect(() => {
		if (isEditMode) {
			setIsMenuOpen(false);
			if (textareaRef.current) {
				textareaRef.current.focus();
				const len = textareaRef.current.value.length;
				textareaRef.current.setSelectionRange(len, len);
			}
		}
	}, [isEditMode]);

	const resizeTextarea = () => {
		const textarea = textareaRef.current;
		if (!textarea) return;
		if (isUserResizedRef.current) {
			textarea.style.overflowY = "auto";
			return;
		}

		const computed = window.getComputedStyle(textarea);
		const lineHeight = Number.parseFloat(computed.lineHeight || "20") || 20;
		const paddingTop = Number.parseFloat(computed.paddingTop || "0");
		const paddingBottom = Number.parseFloat(computed.paddingBottom || "0");
		const maxHeight = lineHeight * 5 + paddingTop + paddingBottom;

		textarea.style.height = "auto";
		const nextHeight = Math.min(textarea.scrollHeight, maxHeight);
		textarea.style.height = `${nextHeight}px`;
		textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
	};

	const getTextareaLimits = (textarea: HTMLTextAreaElement) => {
		const computed = window.getComputedStyle(textarea);
		const lineHeight = Number.parseFloat(computed.lineHeight || "20") || 20;
		const paddingTop = Number.parseFloat(computed.paddingTop || "0");
		const paddingBottom = Number.parseFloat(computed.paddingBottom || "0");
		const minHeight = lineHeight + paddingTop + paddingBottom;
		const maxHeight = Number.parseFloat(computed.maxHeight || "0") || Math.min(window.innerHeight * 0.7, 720);
		return { minHeight, maxHeight };
	};

	useEffect(() => {
		resizeTextarea();
	}, [content, initialValue]);

	useEffect(() => {
		isUserResizedRef.current = false;
		resizeStartHeightRef.current = null;
	}, [initialValue, isEditMode]);

	useEffect(() => {
		return () => {
			resizeDragCleanupRef.current?.();
			resizeDragCleanupRef.current = null;
		};
	}, []);

	const handleTextareaMouseDown = () => {
		if (!textareaRef.current) {
			return;
		}
		resizeStartHeightRef.current = textareaRef.current.offsetHeight;
	};

	const handleTextareaMouseUp = () => {
		if (!textareaRef.current) {
			return;
		}
		const startHeight = resizeStartHeightRef.current;
		resizeStartHeightRef.current = null;
		if (startHeight === null) {
			return;
		}
		if (Math.abs(textareaRef.current.offsetHeight - startHeight) >= 2) {
			isUserResizedRef.current = true;
			textareaRef.current.style.overflowY = "auto";
		}
	};

	const handleComposerResizeMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
		if (variant !== "composer" || !textareaRef.current) {
			return;
		}

		event.preventDefault();
		setIsMenuOpen(false);

		const textarea = textareaRef.current;
		const { minHeight, maxHeight } = getTextareaLimits(textarea);
		const startY = event.clientY;
		const startHeight = textarea.offsetHeight;

		const onMouseMove = (moveEvent: MouseEvent) => {
			const delta = startY - moveEvent.clientY;
			const nextHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + delta));
			isUserResizedRef.current = true;
			textarea.style.height = `${nextHeight}px`;
			textarea.style.overflowY = "auto";
		};

		const cleanup = () => {
			window.removeEventListener("mousemove", onMouseMove);
			window.removeEventListener("mouseup", cleanup);
			document.body.style.removeProperty("user-select");
			document.body.style.removeProperty("cursor");
			resizeDragCleanupRef.current = null;
		};

		document.body.style.setProperty("user-select", "none");
		document.body.style.setProperty("cursor", "ns-resize");
		window.addEventListener("mousemove", onMouseMove);
		window.addEventListener("mouseup", cleanup);
		resizeDragCleanupRef.current = cleanup;
	};

	const uploadFiles = async (files: File[]) => {
		if (files.length === 0) return content;

		let currentContent = content;
		setIsUploading(true);
		try {
			for (const file of files) {
				if (file.type.startsWith("image/")) {
					const uploadedImage = await uploadImageFromBrowser(file);
					const snippet = `![${uploadedImage.originalName}](${uploadedImage.url})`;
					currentContent = currentContent + (currentContent ? "\n" : "") + snippet;
					setContent(currentContent);
					continue;
				}
				if (file.type.startsWith("video/")) {
					const uploadedVideo = await uploadVideoFromBrowser(file);
					const snippet = uploadedVideo.url;
					currentContent = currentContent + (currentContent ? "\n" : "") + snippet;
					setContent(currentContent);
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
					throw new Error(parsed.error ?? "파일 업로드에 실패했습니다");
				}
				const data = parsed.data;

				const snippet =
					data.type === "image"
						? `![${data.originalName}](${data.url})`
						: data.type === "video"
							? data.url
							: `[📦 ${data.originalName}](${data.url})`;

				currentContent = currentContent + (currentContent ? "\n" : "") + snippet;
				setContent(currentContent);
			}

			showToast({ type: "success", message: "파일 업로드 완료" });
			setIsMenuOpen(false);
			return currentContent;
		} catch (error) {
			console.error("Comment attachment upload error:", error);
			showToast({
				type: "error",
				message: error instanceof Error ? error.message : "파일 업로드에 실패했습니다",
			});
			return currentContent;
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

	const handlePaste = async (event: React.ClipboardEvent) => {
		const items = event.clipboardData.items;
		const files: File[] = [];

		for (let i = 0; i < items.length; i++) {
			if (items[i].kind === "file") {
				const file = items[i].getAsFile();
				if (file && file.type.startsWith("image/")) {
					files.push(file);
				}
			}
		}

		if (files.length > 0) {
			event.preventDefault();
			const updatedContent = await uploadFiles(files);
			// 이미지 붙여넣기 시 자동 전송 (내용이 있는 경우만)
			if (updatedContent.trim()) {
				void handleFormSubmit(updatedContent);
			}
		}
	};

	const handleFormSubmit = async (overrideContent?: string) => {
		if (isSubmitting) {
			return;
		}
		const targetContent = overrideContent ?? content;
		const trimmedContent = targetContent.trim();
		if (!trimmedContent && !isEditMode) {
			showToast({ type: "error", message: "댓글 내용을 입력해줘" });
			return;
		}

		setIsSubmitting(true);
		try {
			await onSubmit(targetContent);
			isUserResizedRef.current = false;
			resizeStartHeightRef.current = null;
			setContent("");
			if (postId) {
				localStorage.removeItem(`comment_draft_${postId}`);
			}
		} catch (error) {
			console.error("Comment submit error:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		await handleFormSubmit();
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
				className={`comment-form ${variant} ${isEditMode ? "edit-mode" : ""} ${isDragActive ? "drag-active" : ""}`}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				{replyTo && (
					<div className="reply-bar">
						<div className="reply-meta">
							<span>
								<span className="reply-name">@{replyTo}</span>님에게 답장
							</span>
							{replyPreview && <span className="reply-preview-inline">{replyPreview}</span>}
						</div>
						{onCancel && (
							<button type="button" className="reply-cancel" onClick={onCancel}>
								<X size={14} />
							</button>
						)}
					</div>
				)}

				{variant === "composer" && (
					<button
						type="button"
						className="composer-resize-handle"
						onMouseDown={handleComposerResizeMouseDown}
						aria-label="댓글 입력창 높이 조절"
					/>
				)}

				<div className="form-input-wrapper">
					{!isEditMode && (
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
					)}

					<textarea
						id={textareaId}
						ref={textareaRef}
						value={content}
						onChange={(event) => setContent(event.target.value)}
						onKeyDown={(event) => {
							// IME 조합 중에는 무시
							if (event.nativeEvent.isComposing) return;

							// Escape 키: 취소 처리
							if (event.key === "Escape" && onCancel) {
								event.preventDefault();
								onCancel();
								return;
							}

							// 엔터키: 쉬프트 없이 누르면 전송
							if (event.key === "Enter" && !event.shiftKey) {
								event.preventDefault();
								if ((content.trim() || isEditMode) && !disabled && !isUploading && !isSubmitting) {
									void handleFormSubmit();
								}
								return;
							}

							// ArrowUp: 입력이 비어있고 커서가 시작점이면 마지막 내 댓글 수정 진입
							if (
								event.key === "ArrowUp" &&
								!isEditMode &&
								!content.trim() &&
								onRequestEditLatestOwnComment &&
								textareaRef.current &&
								textareaRef.current.selectionStart === 0 &&
								textareaRef.current.selectionEnd === 0
							) {
								event.preventDefault();
								onRequestEditLatestOwnComment();
							}
						}}
						placeholder={placeholder}
						disabled={disabled}
						className="comment-textarea"
						rows={1}
						onFocus={() => setIsMenuOpen(false)}
						onPaste={handlePaste}
						onMouseDown={handleTextareaMouseDown}
						onMouseUp={handleTextareaMouseUp}
					/>

					<button
						type="submit"
						disabled={disabled || isUploading || isSubmitting || !content.trim()}
						className="submit-btn"
					>
						{isUploading || isSubmitting ? text("comment.uploadingButton") : disabled ? "..." : text("comment.submitButton")}
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

				<input
					type="file"
					ref={fileInputRef}
					onChange={handleFileSelect}
					accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.webm,.mov,.pdf,.txt,.md,.json,.zip"
					style={{ display: "none" }}
				/>
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
					padding: 0 12px; /* 패딩 제거 (기존 4px -> 0px, 상하 총 8px 감소) */
					background: var(--bg-secondary);
					border: none;
					border-radius: 10px;
					box-shadow: none;
				}

				.comment-form.inline {
					padding: 0;
					background: transparent;
					border: none;
				}

				.composer-resize-handle {
					display: flex;
					justify-content: center;
					align-items: center;
					width: 100%;
					height: 12px;
					padding: 0;
					margin-bottom: 4px;
					background: transparent;
					border: 0;
					cursor: ns-resize;
					touch-action: none;
				}

				.composer-resize-handle::before {
					content: "";
					display: block;
					width: 56px;
					height: 4px;
					border-radius: 999px;
					background: color-mix(in srgb, var(--border) 70%, transparent);
					transition: background-color 0.15s ease;
				}

				.composer-resize-handle:hover::before,
				.composer-resize-handle:active::before {
					background: color-mix(in srgb, var(--accent) 55%, var(--border));
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

				.reply-meta {
					display: flex;
					flex-direction: column;
					gap: 2px;
					min-width: 0;
				}

				.reply-preview-inline {
					font-size: 0.78rem;
					color: var(--text-muted);
					white-space: nowrap;
					overflow: hidden;
					text-overflow: ellipsis;
					max-width: min(100%, 420px);
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
						align-items: flex-end;
						gap: 8px;
					}

					.comment-form.edit-mode .form-input-wrapper {
						align-items: stretch;
					}

				.plus-btn-wrapper {
					position: relative;
					flex-shrink: 0;
				}

				.plus-btn {
					width: 34px;
					height: 34px;
					background: var(--bg-secondary);
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
						left: 0;
						bottom: calc(100% + 8px);
						background: color-mix(in srgb, var(--color-bg-secondary) 95%, transparent);
						backdrop-filter: blur(4px);
						border: 1px solid var(--border);
					border-radius: 8px;
					padding: 4px;
					min-width: 170px;
					max-width: min(240px, calc(100vw - 64px));
					box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
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
					line-height: 1.45;
					resize: vertical;
					min-height: calc(1.45em + 20px);
					max-height: min(70vh, 720px);
					overflow-y: auto;
				}

				.comment-form.composer .comment-textarea {
					background: var(--bg-primary);
					resize: none;
				}

				.comment-form.edit-mode .comment-textarea {
					background: rgba(0, 0, 0, 0.4);
					border-color: rgba(255, 255, 255, 0.1);
				}

				.comment-textarea:focus {
					outline: none;
					border-color: var(--accent);
					box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
				}

					.submit-btn {
						padding: 0 12px;
						height: 34px;
						background: var(--color-accent, #8b2332);
						border: none;
						border-radius: 6px;
						display: inline-flex;
						align-items: center;
						justify-content: center;
						color: white;
						font-size: 0.9rem;
						font-weight: 600;
						cursor: pointer;
						white-space: nowrap;
					}

					.comment-form.edit-mode .submit-btn {
						height: auto;
						min-height: 34px;
					}

				.submit-btn:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

					.submit-btn:not(:disabled):hover {
						background: var(--color-accent-hover, #6b1a28);
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
						width: 34px;
						height: 34px;
					}

						.plus-menu {
							left: 0;
							bottom: calc(100% + 8px);
						}

					.submit-btn {
						padding: 0 12px;
						height: 34px;
					}
				}
			`}</style>
		</>
	);
}
