'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Reply {
	id: number;
	content: string;
	createdAt: string;
	author: {
		id: number;
		nickname: string;
		role: string;
	};
}

interface InquiryDetailProps {
	inquiry: {
		id: number;
		title: string;
		content: string;
		status: string;
		createdAt: string;
		author: {
			nickname: string;
		};
	};
	replies: Reply[];
	currentUserId: number;
	currentUserRole: string;
}

export default function InquiryDetail({
	inquiry,
	replies,
	currentUserId,
	currentUserRole,
}: InquiryDetailProps) {
	const router = useRouter();
	const [replyContent, setReplyContent] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleReplySubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!replyContent.trim()) return;

		setIsSubmitting(true);
		try {
			const res = await fetch(`/api/inquiries/${inquiry.id}/reply`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: replyContent }),
			});

			if (!res.ok) throw new Error('Failed to submit reply');

			setReplyContent('');
			router.refresh(); // 데이터 갱신
		} catch (error) {
			console.error(error);
			alert('답변 등록에 실패했습니다.');
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="space-y-6">
			{/* 문의 내용 */}
			<div className="bg-bg-secondary rounded-lg p-6 border border-border">
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-xl font-bold">{inquiry.title}</h2>
					<span
						className={`px-2 py-1 text-xs rounded font-medium ${inquiry.status === 'answered'
								? 'bg-success text-white'
								: 'bg-warning text-black'
							}`}
					>
						{inquiry.status === 'answered' ? '답변 완료' : '대기 중'}
					</span>
				</div>
				<div className="text-sm text-text-muted mb-6 flex items-center gap-2">
					<span>{inquiry.author.nickname}</span>
					<span>•</span>
					<span>{new Date(inquiry.createdAt).toLocaleString('ko-KR')}</span>
				</div>
				<div className="whitespace-pre-wrap leading-relaxed">
					{inquiry.content}
				</div>
			</div>

			{/* 답변 목록 */}
			<div className="space-y-4">
				<h3 className="font-bold text-lg">답변 {replies.length}개</h3>
				{replies.map((reply) => (
					<div
						key={reply.id}
						className={`p-4 rounded-lg border ${reply.author.role === 'admin'
								? 'bg-bg-tertiary border-success/30 ml-4'
								: 'bg-bg-secondary border-border'
							}`}
					>
						<div className="flex justify-between items-center mb-2">
							<div className="flex items-center gap-2">
								<span className={`font-medium ${reply.author.role === 'admin' ? 'text-success' : ''}`}>
									{reply.author.nickname}
									{reply.author.role === 'admin' && ' (관리자)'}
								</span>
							</div>
							<span className="text-xs text-text-muted">
								{new Date(reply.createdAt).toLocaleString('ko-KR')}
							</span>
						</div>
						<div className="whitespace-pre-wrap text-sm">{reply.content}</div>
					</div>
				))}
			</div>

			{/* 답변 작성 폼 */}
			<div className="bg-bg-secondary rounded-lg p-6 border border-border">
				<h4 className="font-bold mb-4">답변 작성</h4>
				<form onSubmit={handleReplySubmit}>
					<textarea
						value={replyContent}
						onChange={(e) => setReplyContent(e.target.value)}
						className="input-base w-full h-32 mb-4"
						placeholder="답변 내용을 입력하세요..."
						required
					/>
					<div className="flex justify-end">
						<button
							type="submit"
							disabled={isSubmitting}
							className="btn btn-primary"
						>
							{isSubmitting ? '등록 중...' : '답변 등록'}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
