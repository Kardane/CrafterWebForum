"use client";

import { useState, useRef } from "react";
import { Plus, Paperclip, BarChart3, HelpCircle, X } from "lucide-react";
import PollModal from "@/components/poll/PollModal";
import { serializePollData, PollData } from "@/lib/poll";

interface CommentFormProps {
	onSubmit: (content: string) => void;
	disabled?: boolean;
	placeholder?: string;
	initialValue?: string;
	onCancel?: () => void;
	replyTo?: string;
}

/**
 * 댓글 작성 폼 - 레거시 스타일
 * - 하단 고정 (sticky)
 * - + 버튼 메뉴 (파일 첨부, 투표 만들기, 마크다운 도움말)
 * - 답장 바 표시
 */
export default function CommentForm({
	onSubmit,
	disabled = false,
	placeholder = "댓글을 입력하세요...",
	initialValue = "",
	onCancel,
	replyTo
}: CommentFormProps) {
	const [content, setContent] = useState(initialValue);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isPollModalOpen, setIsPollModalOpen] = useState(false);
	const [isSyntaxHelpOpen, setIsSyntaxHelpOpen] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// 폼 제출
	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		if (!content.trim()) {
			alert("댓글 내용을 입력해주세요.");
			return;
		}

		onSubmit(content);
		setContent("");
	};

	// 파일 선택
	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];

		// TODO: 파일 업로드 API 호출
		// 현재는 placeholder 텍스트 추가
		const fileText = `[파일: ${file.name}]`;
		setContent((prev) => prev + (prev ? "\n" : "") + fileText);

		// 메뉴 닫기
		setIsMenuOpen(false);
	};

	// 투표 생성
	const handlePollCreate = (pollData: PollData) => {
		const pollString = serializePollData(pollData);
		setContent((prev) => prev + (prev ? "\n" : "") + pollString);
		setIsPollModalOpen(false);
		setIsMenuOpen(false);
	};

	return (
		<>
			<form onSubmit={handleSubmit} className="comment-form">
				{/* 답장 바 */}
				{replyTo && (
					<div className="reply-bar">
						<span>
							<span className="reply-name">@{replyTo}</span>님에게 답장
						</span>
						{onCancel && (
							<button
								type="button"
								className="reply-cancel"
								onClick={onCancel}
							>
								<X size={14} />
							</button>
						)}
					</div>
				)}

				{/* 입력 영역 */}
				<div className="form-input-wrapper">
					{/* + 버튼 */}
					<div className="plus-btn-wrapper">
						<button
							type="button"
							className={`plus-btn ${isMenuOpen ? "active" : ""}`}
							onClick={() => setIsMenuOpen(!isMenuOpen)}
						>
							<Plus size={20} />
						</button>

						{/* 메뉴 드롭다운 */}
						{isMenuOpen && (
							<div className="plus-menu">
								<button
									type="button"
									className="menu-item"
									onClick={() => fileInputRef.current?.click()}
								>
									<Paperclip size={16} />
									파일 첨부
								</button>
								<button
									type="button"
									className="menu-item"
									onClick={() => setIsPollModalOpen(true)}
								>
									<BarChart3 size={16} />
									투표 만들기
								</button>
								<button
									type="button"
									className="menu-item"
									onClick={() => setIsSyntaxHelpOpen(!isSyntaxHelpOpen)}
								>
									<HelpCircle size={16} />
									문법 도움말
								</button>
							</div>
						)}
					</div>

					{/* 텍스트 입력 */}
					<textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder={placeholder}
						disabled={disabled}
						className="comment-textarea"
						rows={2}
						onFocus={() => setIsMenuOpen(false)}
					/>

					{/* 제출 버튼 */}
					<button
						type="submit"
						disabled={disabled || !content.trim()}
						className="submit-btn"
					>
						{disabled ? "..." : "전송"}
					</button>
				</div>

				{/* 취소 버튼 (수정 모드일 때) */}
				{onCancel && !replyTo && (
					<div className="cancel-wrapper">
						<button
							type="button"
							onClick={onCancel}
							disabled={disabled}
							className="btn btn-secondary btn-sm"
						>
							취소
						</button>
					</div>
				)}

				{/* 숨겨진 파일 입력 */}
				<input
					type="file"
					ref={fileInputRef}
					onChange={handleFileSelect}
					style={{ display: "none" }}
				/>

				{/* 문법 도움말 */}
				{isSyntaxHelpOpen && (
					<div className="syntax-help">
						<div className="syntax-title">마크다운 문법</div>
						<div className="syntax-item">
							<code>**굵게**</code> → <strong>굵게</strong>
						</div>
						<div className="syntax-item">
							<code>*기울임*</code> → <em>기울임</em>
						</div>
						<div className="syntax-item">
							<code>~~취소선~~</code> → <del>취소선</del>
						</div>
						<div className="syntax-item">
							<code>`코드`</code> → <code>코드</code>
						</div>
						<div className="syntax-item">
							<code>[링크](url)</code> → 링크
						</div>
						<div className="syntax-item">
							<code>```언어{"\n"}코드```</code> → 코드 블록
						</div>
					</div>
				)}
			</form>

			{/* 투표 모달 */}
			<PollModal
				isOpen={isPollModalOpen}
				onClose={() => setIsPollModalOpen(false)}
				onSubmit={handlePollCreate}
			/>

			{/* 스타일 */}
			<style jsx>{`
				.comment-form {
					background: var(--bg-secondary);
					border-top: 1px solid var(--border);
					padding: 12px;
					position: sticky;
					bottom: 0;
					z-index: 10;
				}

				.reply-bar {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 8px 12px;
					margin-bottom: 8px;
					background: var(--bg-tertiary);
					border-radius: 4px;
					font-size: 0.85rem;
					color: var(--text-secondary);
				}

				.reply-name {
					color: var(--accent);
					font-weight: 500;
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
					align-items: flex-start;
					gap: 8px;
				}

				.plus-btn-wrapper {
					position: relative;
				}

				.plus-btn {
					width: 36px;
					height: 36px;
					background: var(--bg-tertiary);
					border: 1px solid var(--border);
					border-radius: 50%;
					display: flex;
					align-items: center;
					justify-content: center;
					cursor: pointer;
					color: var(--text-muted);
					transition: all 0.2s;
				}

				.plus-btn:hover,
				.plus-btn.active {
					background: var(--accent);
					border-color: var(--accent);
					color: white;
					transform: rotate(45deg);
				}

				.plus-menu {
					position: absolute;
					bottom: 100%;
					left: 0;
					margin-bottom: 8px;
					background: var(--bg-secondary);
					border: 1px solid var(--border);
					border-radius: 8px;
					padding: 4px;
					min-width: 160px;
					box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
					padding: 8px 12px;
					background: var(--bg-tertiary);
					border: 1px solid var(--border);
					border-radius: 4px;
					color: var(--text-primary);
					font-size: 0.9rem;
					resize: none;
					min-height: 36px;
					max-height: 150px;
				}

				.comment-textarea:focus {
					outline: none;
					border-color: var(--accent);
				}

				.submit-btn {
					padding: 8px 16px;
					background: var(--accent);
					border: none;
					border-radius: 4px;
					color: white;
					font-size: 0.9rem;
					font-weight: 500;
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
					margin-top: 8px;
					text-align: right;
				}

				.syntax-help {
					margin-top: 12px;
					padding: 12px;
					background: var(--bg-tertiary);
					border-radius: 4px;
					font-size: 0.85rem;
				}

				.syntax-title {
					font-weight: 600;
					color: var(--text-primary);
					margin-bottom: 8px;
				}

				.syntax-item {
					display: flex;
					align-items: center;
					gap: 8px;
					color: var(--text-secondary);
					margin-bottom: 4px;
				}

				.syntax-item code {
					background: var(--bg-secondary);
					padding: 2px 6px;
					border-radius: 3px;
					font-family: monospace;
				}
			`}</style>
		</>
	);
}
