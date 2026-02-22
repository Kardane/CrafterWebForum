'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import InquiryList from '@/components/inquiries/InquiryList';
import { useRealtimeBroadcast } from '@/lib/realtime/useRealtimeBroadcast';
import { REALTIME_EVENTS, REALTIME_TOPICS } from '@/lib/realtime/constants';

export default function InquiriesPage() {
	const { data: session } = useSession();
	const [inquiries, setInquiries] = useState([]);
	const [isLoading, setIsLoading] = useState(true);

	const fetchInquiries = async () => {
		try {
			const res = await fetch('/api/inquiries', { cache: 'no-store' });
			if (res.ok) {
				const data = await res.json();
				setInquiries(data.inquiries);
			}
		} catch (error) {
			console.error('Failed to fetch inquiries:', error);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		void fetchInquiries();
	}, []);

	useRealtimeBroadcast(REALTIME_TOPICS.adminInquiries(), {
		[REALTIME_EVENTS.INQUIRY_STATUS_UPDATED]: () => {
			void fetchInquiries();
		},
		[REALTIME_EVENTS.INQUIRY_REPLY_CREATED]: () => {
			void fetchInquiries();
		},
		[REALTIME_EVENTS.ADMIN_INQUIRY_PENDING_COUNT_UPDATED]: () => {
			void fetchInquiries();
		},
	});

	useRealtimeBroadcast(
		session?.user?.id ? REALTIME_TOPICS.user(Number(session.user.id)) : null,
		{
			[REALTIME_EVENTS.INQUIRY_STATUS_UPDATED]: () => {
				void fetchInquiries();
			},
			[REALTIME_EVENTS.INQUIRY_REPLY_CREATED]: () => {
				void fetchInquiries();
			},
		}
	);

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
