"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

/**
 * 포스트 작성 페이지 - 레거시 스타일
 * - 태그 선택 UI
 * - 드래그 앤 드롭 이미지 업로드
 * - 마크다운 도움말
 * - 임시 저장 (localStorage)
 */
export default function NewPostPage() {
	const router = useRouter();
	const { data: session } = useSession();
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [selectedTags, setSelectedTags] = useState<string[]>([]);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isDragging, setIsDragging] = useState(false);

	// 사용 가능한 태그 목록
	const availableTags = [
		"플러그인",
		"모드",
		"데이터팩",
		"리소스팩",
		"Skript",
		"질문",
		"공유",
		"토론"
	];

	// 임시 저장 복원
	useEffect(() => {
		const savedTitle = localStorage.getItem("draft_post_title");
		const savedContent = localStorage.getItem("draft_post_content");
		const savedTags = localStorage.getItem("draft_post_tags");

		if (savedTitle) setTitle(savedTitle);
		if (savedContent) setContent(savedContent);
		if (savedTags) {
			try {
				const tags = JSON.parse(savedTags);
				if (Array.isArray(tags)) setSelectedTags(tags);
			} catch (e) {
				console.error("Failed to parse saved tags", e);
			}
		}
	}, []);

	// 임시 저장
	const saveDraft = () => {
		localStorage.setItem("draft_post_title", title);
		localStorage.setItem("draft_post_content", content);
		localStorage.setItem("draft_post_tags", JSON.stringify(selectedTags));
	};

	// 임시 저장 삭제
	const clearDraft = () => {
		localStorage.removeItem("draft_post_title");
		localStorage.removeItem("draft_post_content");
		localStorage.removeItem("draft_post_tags");
	};

	// 태그 토글
	const toggleTag = (tag: string) => {
		if (selectedTags.includes(tag)) {
			setSelectedTags(selectedTags.filter((t) => t !== tag));
		} else {
			if (selectedTags.length >= 5) {
				alert("태그는 최대 5개까지 선택할 수 있습니다");
				return;
			}
			setSelectedTags([...selectedTags, tag]);
		}
	};

	// 드래그 앤 드롭 핸들러
	const handleDragEnter = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	const handleDrop = async (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);

		const file = e.dataTransfer.files[0];
		if (file && file.type.startsWith("image/")) {
			await uploadImage(file);
		}
	};

	// 이미지 업로드
	const uploadImage = async (file: File) => {
		const formData = new FormData();
		formData.append("file", file);

		try {
			const res = await fetch("/api/upload", {
				method: "POST",
				body: formData
			});

			const data = await res.json();

			if (data.url) {
				// 커서 위치에 이미지 URL 삽입
				const textarea = document.getElementById("content") as HTMLTextAreaElement;
				const start = textarea.selectionStart;
				const end = textarea.selectionEnd;
				const newText = `\n${data.url}\n`;

				setContent(
					content.substring(0, start) + newText + content.substring(end)
				);

				alert("이미지가 업로드되었습니다");
			} else {
				alert(data.error || "업로드 실패");
			}
		} catch (error) {
			console.error("Upload error:", error);
			alert("업로드 중 오류가 발생했습니다");
		}
	};

	// 파일 선택 핸들러
	const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file && file.type.startsWith("image/")) {
			await uploadImage(file);
		}
		e.target.value = "";
	};

	// 제출
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!title.trim() || !content.trim()) {
			alert("제목과 내용을 입력해주세요");
			return;
		}

		if (selectedTags.length === 0) {
			alert("태그를 최소 1개 이상 선택해주세요");
			return;
		}

		if (!session?.user?.id) {
			alert("로그인이 필요합니다");
			return;
		}

		setIsSubmitting(true);

		try {
			const res = await fetch("/api/posts", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					title,
					content,
					tags: selectedTags,
					authorId: session.user.id
				})
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || "Failed to create post");
			}

			clearDraft();
			alert("포스트가 작성되었습니다");
			router.push(`/posts/${data.postId}`);
		} catch (error) {
			console.error("Post creation error:", error);
			alert("포스트 작성에 실패했습니다");
		} finally {
			setIsSubmitting(false);
		}
	};

	// 입력 변경 시 임시 저장
	useEffect(() => {
		saveDraft();
	}, [title, content, selectedTags]);

	return (
		<div className="max-w-4xl mx-auto p-6">
			{/* 헤더 */}
			<div className="flex items-center gap-3 mb-6">
				<Link href="/" className="btn btn-secondary btn-sm">
					<ArrowLeft size={16} />
					목록
				</Link>
				<h1 className="text-2xl font-bold">✏️ 새 포스트</h1>
			</div>

			{/* 드래그 오버레이 */}
			{isDragging && (
				<div className="drag-overlay">
					<span className="drag-overlay-text">📷 이미지를 여기에 놓으세요</span>
				</div>
			)}

			{/* 폼 */}
			<form
				onSubmit={handleSubmit}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				{/* 제목 */}
				<div className="form-group">
					<label className="form-label" htmlFor="title">
						제목
					</label>
					<input
						type="text"
						id="title"
						className="form-input"
						placeholder="포스트 제목을 입력하세요"
						maxLength={100}
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						required
					/>
				</div>

				{/* 태그 */}
				<div className="form-group">
					<label className="form-label">태그 (최대 5개)</label>
					<div className="tags-selector">
						{availableTags.map((tag) => (
							<button
								key={tag}
								type="button"
								className={`tag tag-option ${selectedTags.includes(tag) ? "selected" : ""}`}
								onClick={() => toggleTag(tag)}
							>
								{tag}
							</button>
						))}
					</div>
				</div>

				{/* 내용 */}
				<div className="form-group">
					<label className="form-label" htmlFor="content">
						내용
					</label>
					<label
						className="upload-btn"
						onClick={() => document.getElementById("imageUpload")?.click()}
					>
						📷 파일 추가
					</label>
					<textarea
						id="content"
						className="form-textarea"
						placeholder="내용을 입력하세요. imgur 링크, 이미지 URL 등은 자동으로 임베드됩니다."
						value={content}
						onChange={(e) => setContent(e.target.value)}
						required
						rows={12}
					/>

					{/* 마크다운 도움말 */}
					<details className="markdown-help">
						<summary>📝 마크다운 문법 도움말</summary>
						<div className="markdown-help-content">
							<code>**굵게**</code> → <strong>굵게</strong> &nbsp;|&nbsp;
							<code>*이탤릭*</code> → <em>이탤릭</em> &nbsp;|&nbsp;
							<code>~~취소선~~</code> → <del>취소선</del>
							<br />
							<code># 제목</code> (1~6개 가능) &nbsp;|&nbsp;
							<code>`인라인 코드`</code> → <code>인라인 코드</code>
							<br />
							<code>&gt; 인용문</code> → 인용 블록 &nbsp;|&nbsp;
							<code>- 목록</code> → 순서없는 목록 &nbsp;|&nbsp;
							<code>1. 목록</code> → 순서있는 목록
							<br />
							<code>---</code> → 수평선 &nbsp;|&nbsp;
							<code>```언어 코드 ```</code> → 코드 블록 &nbsp;|&nbsp;
							<code>[텍스트](URL)</code> → 링크
						</div>
					</details>
				</div>

				{/* 버튼 */}
				<div className="flex gap-3">
					<button
						type="submit"
						className="btn btn-primary"
						disabled={isSubmitting}
					>
						{isSubmitting ? "작성 중..." : "포스트 작성"}
					</button>
					<Link href="/" className="btn btn-secondary">
						취소
					</Link>
				</div>
			</form>

			{/* 숨겨진 파일 입력 */}
			<input
				type="file"
				id="imageUpload"
				accept="image/*"
				style={{ display: "none" }}
				onChange={handleFileSelect}
			/>

			{/* 스타일 */}
			<style jsx>{`
				.tags-selector {
					display: flex;
					flex-wrap: wrap;
					gap: 8px;
					margin-top: 8px;
				}

				.tag-option {
					cursor: pointer;
					opacity: 0.6;
					transition: opacity 0.2s;
					background: var(--bg-tertiary);
				}

				.tag-option.selected {
					opacity: 1;
					box-shadow: 0 0 0 2px var(--accent);
					background: var(--accent);
					color: white;
				}

				.upload-btn {
					display: inline-flex;
					align-items: center;
					gap: 4px;
					cursor: pointer;
					padding: 6px 12px;
					background: var(--bg-tertiary);
					border-radius: 4px;
					font-size: 0.85rem;
					margin-bottom: 8px;
				}

				.upload-btn:hover {
					background: var(--bg-secondary);
				}

				.drag-overlay {
					position: fixed;
					inset: 0;
					background: rgba(0, 0, 0, 0.7);
					display: flex;
					justify-content: center;
					align-items: center;
					z-index: 9999;
				}

				.drag-overlay-text {
					color: white;
					font-size: 1.5rem;
					pointer-events: none;
				}

				.markdown-help {
					margin-top: 8px;
					color: var(--text-muted);
					font-size: 0.85rem;
				}

				.markdown-help summary {
					cursor: pointer;
					user-select: none;
				}

				.markdown-help-content {
					background: var(--bg-tertiary);
					padding: 12px;
					border-radius: 8px;
					margin-top: 8px;
					line-height: 1.8;
				}

				.markdown-help-content code {
					background: var(--bg-secondary);
					padding: 2px 4px;
					border-radius: 3px;
				}
			`}</style>
		</div>
	);
}
