'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import InquiryList from '@/components/inquiries/InquiryList';

export default function InquiriesPage() {
	const [inquiries, setInquiries] = useState([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		async function fetchInquiries() {
			try {
				const res = await fetch('/api/inquiries');
				if (res.ok) {
					const data = await res.json();
					setInquiries(data.inquiries);
				}
			} catch (error) {
				console.error('Failed to fetch inquiries:', error);
			} finally {
				setIsLoading(false);
			}
		}
		fetchInquiries();
	}, []);

	return (
		<div className="max-w-4xl mx-auto p-6">
			<header className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Link href="/" className="btn btn-secondary btn-sm">
						← 메인
					</Link>
					<h1 className="text-2xl font-bold flex items-center gap-2">
						<span>💬</span> 문의하기
					</h1>
				</div>
				<Link href="/inquiries/new" className="btn btn-primary">
					+ 새 문의
				</Link>
			</header>

			{isLoading ? (
				<div className="text-center py-12">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
					<p className="mt-4 text-text-muted">로딩 중...</p>
				</div>
			) : (
				<InquiryList inquiries={inquiries} />
			)}
		</div>
	);
}
