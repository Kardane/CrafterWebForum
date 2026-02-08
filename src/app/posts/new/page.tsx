"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, Image as ImageIcon, FileText, X } from "lucide-react";
import Link from "next/link";

/**
 * 포스트 작성 페이지 - Tailwind CSS 재구현
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
		// 자식 요소로 들어갈 때 깜빡임 방지용 로직 필요시 추가 (여기서는 간단히 처리)
		if (e.currentTarget.contains(e.relatedTarget as Node)) return;
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
			// authorId는 이제 서버 세션에서 처리하거나 API에서 검증
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
			// alert("포스트가 작성되었습니다"); // NextJS 전환에서는 굳이 alert 안 띄워도 됨
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
		<div className="max-w-4xl mx-auto p-4 md:p-6 pb-24 relative min-h-screen">
			{/* 헤더 */}
			<div className="flex items-center gap-4 mb-8">
				<Link
					href="/"
					className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors bg-bg-secondary px-3 py-1.5 rounded-md text-sm"
				>
					<ArrowLeft size={16} />
					목록으로
				</Link>
				<h1 className="text-2xl font-bold text-text-primary">새 포스트 작성</h1>
			</div>

			{/* 드래그 오버레이 */}
			{isDragging && (
				<div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
					<div className="text-white text-xl font-bold flex flex-col items-center gap-4 animate-bounce">
						<ImageIcon size={48} />
						<span>이미지를 여기에 놓으세요</span>
					</div>
				</div>
			)}

			{/* 폼 */}
			<form
				onSubmit={handleSubmit}
				className="flex flex-col gap-6"
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				onDragOver={handleDragOver}
				onDrop={handleDrop}
			>
				{/* 제목 */}
				<div>
					<label htmlFor="title" className="block text-sm font-semibold text-text-secondary mb-2">
						제목
					</label>
					<input
						type="text"
						id="title"
						className="w-full px-4 py-3 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
						placeholder="제목을 입력하세요"
						maxLength={100}
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						required
					/>
				</div>

				{/* 태그 */}
				<div>
					<label className="block text-sm font-semibold text-text-secondary mb-2 flex justify-between">
						<span>태그 선택</span>
						<span className="text-xs text-text-muted font-normal">{selectedTags.length} / 5</span>
					</label>
					<div className="flex flex-wrap gap-2 p-3 bg-bg-tertiary rounded-lg border border-border/50">
						{availableTags.map((tag) => {
							const isSelected = selectedTags.includes(tag);
							return (
								<button
									key={tag}
									type="button"
									className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${isSelected
											? "bg-accent text-white border-accent shadow-md shadow-accent/20"
											: "bg-bg-secondary text-text-secondary border-border hover:border-text-muted hover:bg-bg-tertiary"
										}`}
									onClick={() => toggleTag(tag)}
								>
									{tag}
								</button>
							);
						})}
					</div>
				</div>

				{/* 내용 */}
				<div className="flex-1 flex flex-col">
					<div className="flex justify-between items-center mb-2">
						<label htmlFor="content" className="block text-sm font-semibold text-text-secondary">
							내용
						</label>
						<button
							type="button"
							className="text-xs flex items-center gap-1.5 text-accent hover:text-accent-hover font-medium px-2 py-1 rounded bg-accent/10 hover:bg-accent/20 transition-colors"
							onClick={() => document.getElementById("imageUpload")?.click()}
						>
							<ImageIcon size={14} />
							이미지 업로드
						</button>
					</div>

					<div className="relative">
						<textarea
							id="content"
							className="w-full min-h-[400px] px-4 py-3 bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent resize-y transition-all font-mono leading-relaxed"
							placeholder="내용을 입력하세요. 마크다운을 지원합니다."
							value={content}
							onChange={(e) => setContent(e.target.value)}
							required
						/>
						{isDragging && (
							<div className="absolute inset-0 bg-accent/10 border-2 border-dashed border-accent rounded-lg flex items-center justify-center pointer-events-none">
								<span className="text-accent font-semibold">여기에 이미지를 놓으세요</span>
							</div>
						)}
					</div>

					{/* 마크다운 도움말 */}
					<details className="mt-3 group">
						<summary className="flex items-center gap-2 cursor-pointer text-sm text-text-muted hover:text-text-primary transition-colors select-none w-fit">
							<FileText size={14} />
							<span>마크다운 문법 가이드</span>
						</summary>
						<div className="mt-2 p-4 bg-bg-tertiary rounded-lg text-sm text-text-secondary border border-border grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
							<div className="flex justify-between">
								<code>**굵게**</code> <span><strong>굵게</strong></span>
							</div>
							<div className="flex justify-between">
								<code>*이탤릭*</code> <span><em>이탤릭</em></span>
							</div>
							<div className="flex justify-between">
								<code># 제목</code> <span>제목 (H1~H6)</span>
							</div>
							<div className="flex justify-between">
								<code>`코드`</code> <span><code>코드</code></span>
							</div>
							<div className="flex justify-between">
								<code>[링크](URL)</code> <span><span className="text-accent underline">링크</span></span>
							</div>
							<div className="flex justify-between">
								<code>&gt; 인용</code> <span>인용문</span>
							</div>
						</div>
					</details>
				</div>

				{/* 하단 액션 버튼 */}
				<div className="flex justify-end gap-3 mt-4 pt-4 border-t border-border">
					<Link
						href="/"
						className="px-6 py-2.5 rounded-lg text-text-secondary hover:bg-bg-tertiary transition-colors font-medium text-sm"
					>
						취소
					</Link>
					<button
						type="submit"
						disabled={isSubmitting}
						className="px-8 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-white font-semibold shadow-lg shadow-accent/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
					>
						{isSubmitting ? (
							<>
								<span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
								작성 중...
							</>
						) : (
							"포스트 등록"
						)}
					</button>
				</div>
			</form>

			{/* 숨겨진 파일 입력 */}
			<input
				type="file"
				id="imageUpload"
				accept="image/*"
				className="hidden"
				onChange={handleFileSelect}
			/>
		</div>
	);
}
