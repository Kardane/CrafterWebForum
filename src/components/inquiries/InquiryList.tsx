'use client';

import Link from 'next/link';

interface Inquiry {
	id: number;
	title: string;
	status: string;
	createdAt: string;
	authorName: string;
	replyCount: number;
}

interface InquiryListProps {
	inquiries: Inquiry[];
}

export default function InquiryList({ inquiries }: InquiryListProps) {
	if (inquiries.length === 0) {
		return (
			<div className="text-center py-12 text-text-muted">
				문의 내역이 없습니다.
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{inquiries.map((inquiry) => (
				<Link
					key={inquiry.id}
					href={`/inquiries/${inquiry.id}`}
					className="block bg-bg-secondary p-4 rounded-lg hover:bg-bg-tertiary transition-colors border border-border"
				>
					<div className="flex justify-between items-center mb-2">
						<h3 className="font-semibold text-lg text-text-primary">
							{inquiry.title}
						</h3>
						<span
							className={`px-2 py-1 text-xs rounded font-medium ${inquiry.status === 'answered'
									? 'bg-success text-white'
									: 'bg-warning text-black'
								}`}
						>
							{inquiry.status === 'answered' ? '답변 완료' : '대기 중'}
						</span>
					</div>
					<div className="text-sm text-text-muted flex items-center gap-2">
						<span>{inquiry.authorName}</span>
						<span>•</span>
						<span>{new Date(inquiry.createdAt).toLocaleDateString('ko-KR')}</span>
						<span>•</span>
						<span>답변 {inquiry.replyCount}개</span>
					</div>
				</Link>
			))}
		</div>
	);
}
