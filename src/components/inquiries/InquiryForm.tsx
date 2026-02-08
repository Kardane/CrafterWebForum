'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InquiryForm() {
	const router = useRouter();
	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim() || !content.trim()) return;

		setIsSubmitting(true);
		try {
			const res = await fetch('/api/inquiries', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ title, content }),
			});

			if (!res.ok) throw new Error('Failed to create inquiry');

			const data = await res.json();
			router.push(`/inquiries/${data.inquiryId}`);
			router.refresh(); // 목록 갱신
		} catch (error) {
			console.error(error);
			alert('문의 작성에 실패했습니다.');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4 bg-bg-secondary p-6 rounded-lg border border-border">
			<h3 className="text-lg font-bold mb-4">새 문의 작성</h3>
			<div>
				<label className="block text-sm font-medium mb-1">제목</label>
				<input
					type="text"
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					className="input-base w-full"
					required
					maxLength={100}
				/>
			</div>
			<div>
				<label className="block text-sm font-medium mb-1">내용</label>
				<textarea
					value={content}
					onChange={(e) => setContent(e.target.value)}
					className="input-base w-full h-40 resize-y"
					required
					placeholder="문의 내용을 입력하세요..."
				/>
			</div>
			<div className="flex justify-end gap-2">
				<button
					type="button"
					onClick={() => router.back()}
					className="btn btn-secondary"
				>
					취소
				</button>
				<button
					type="submit"
					disabled={isSubmitting}
					className="btn btn-primary"
				>
					{isSubmitting ? '작성 중...' : '문의 작성'}
				</button>
			</div>
		</form>
	);
}
