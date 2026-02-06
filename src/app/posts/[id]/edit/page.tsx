'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

interface EditPostPageProps {
	params: Promise<{ id: string }>;
}

export default function EditPostPage({ params: paramsPromise }: EditPostPageProps) {
	const router = useRouter();
	const { data: session } = useSession();
	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [tags, setTags] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [postId, setPostId] = useState<string | null>(null);

	const availableTags = ['플러그인', '모드', '데이터팩', '리소스팩', 'Skript', '질문', '공유', '토론'];

	useEffect(() => {
		async function loadPost() {
			try {
				const params = await paramsPromise;
				setPostId(params.id);

				const res = await fetch(`/api/posts/${params.id}`);
				if (!res.ok) {
					throw new Error('Failed to load post');
				}

				const data = await res.json();
				const { post } = data;

				// 권한 확인
				if (post.author_id !== session?.user?.id) {
					alert('수정 권한이 없습니다.');
					router.push(`/posts/${params.id}`);
					return;
				}

				setTitle(post.title);
				setContent(post.content);
				setTags(post.tags || []);
			} catch (error) {
				console.error('Load post error:', error);
				alert('게시글을 불러오는데 실패했습니다.');
				router.push('/');
			} finally {
				setIsLoading(false);
			}
		}

		if (session) {
			loadPost();
		}
	}, [paramsPromise, session, router]);

	const handleTagToggle = (tag: string) => {
		setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!title.trim() || !content.trim()) {
			alert('제목과 내용을 입력해주세요.');
			return;
		}

		if (!postId) {
			alert('게시글 ID를 찾을 수 없습니다.');
			return;
		}

		setIsSubmitting(true);

		try {
			const res = await fetch(`/api/posts/${postId}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					title,
					content,
					tags,
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to update post');
			}

			alert('게시글이 수정되었습니다.');
			router.push(`/posts/${postId}`);
		} catch (error) {
			console.error('Post update error:', error);
			alert('게시글 수정에 실패했습니다.');
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-text-secondary">로딩 중...</div>
			</div>
		);
	}

	return (
		<div className="max-w-4xl mx-auto p-6">
			<h1 className="text-3xl font-bold mb-6">게시글 수정</h1>

			<form onSubmit={handleSubmit} className="space-y-6">
				{/* 제목 */}
				<div>
					<label htmlFor="title" className="block text-sm font-medium mb-2">
						제목
					</label>
					<input
						type="text"
						id="title"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						className="input-base w-full"
						placeholder="게시글 제목을 입력하세요"
						required
					/>
				</div>

				{/* 태그 선택 */}
				<div>
					<label className="block text-sm font-medium mb-2">태그</label>
					<div className="flex flex-wrap gap-2">
						{availableTags.map((tag) => (
							<button
								key={tag}
								type="button"
								onClick={() => handleTagToggle(tag)}
								className={`tag ${tags.includes(tag) ? 'active' : ''}`}
							>
								{tag}
							</button>
						))}
					</div>
				</div>

				{/* 내용 */}
				<div>
					<label htmlFor="content" className="block text-sm font-medium mb-2">
						내용 (마크다운 지원)
					</label>
					<textarea
						id="content"
						value={content}
						onChange={(e) => setContent(e.target.value)}
						className="input-base w-full min-h-[400px] font-mono"
						placeholder="마크다운 형식으로 내용을 작성하세요"
						required
					/>
				</div>

				{/* 액션 버튼 */}
				<div className="flex gap-3">
					<button type="submit" disabled={isSubmitting} className="btn btn-primary">
						{isSubmitting ? '수정 중...' : '수정 완료'}
					</button>
					<button
						type="button"
						onClick={() => router.back()}
						className="btn btn-secondary"
						disabled={isSubmitting}
					>
						취소
					</button>
				</div>
			</form>
		</div>
	);
}
