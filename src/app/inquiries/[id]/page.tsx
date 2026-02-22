"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import InquiryDetail from "@/components/inquiries/InquiryDetail";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRealtimeBroadcast } from "@/lib/realtime/useRealtimeBroadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";

interface InquiryResponse {
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
	replies: Array<{
		id: number;
		content: string;
		createdAt: string;
		author: {
			id: number;
			nickname: string;
			role: string;
		};
	}>;
}

export default function InquiryDetailPage() {
	const params = useParams<{ id: string | string[] }>();
	const inquiryId = Array.isArray(params.id) ? params.id[0] : params.id;
	const router = useRouter();
	const { data: session } = useSession();
	const sessionUser = session?.user as { id?: number | string; role?: string } | undefined;
	const [data, setData] = useState<InquiryResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchInquiry = useCallback(async () => {
		try {
			const res = await fetch(`/api/inquiries/${inquiryId}`, { cache: "no-store" });
			if (res.status === 401) {
				router.push("/api/auth/signin");
				return;
			}
			if (res.status === 403) {
				setError("접근 권한이 없습니다.");
				return;
			}
			if (!res.ok) {
				throw new Error("Failed to load inquiry");
			}
			const responseData: InquiryResponse = await res.json();
			setData(responseData);
		} catch (err) {
			console.error(err);
			setError("문의 내용을 불러오는데 실패했습니다.");
		} finally {
			setIsLoading(false);
		}
	}, [inquiryId, router]);

	useEffect(() => {
		if (inquiryId) {
			void fetchInquiry();
		}
	}, [inquiryId, fetchInquiry]);

	useRealtimeBroadcast(
		inquiryId ? REALTIME_TOPICS.inquiry(Number(inquiryId)) : null,
		{
			[REALTIME_EVENTS.INQUIRY_REPLY_CREATED]: () => {
				void fetchInquiry();
			},
			[REALTIME_EVENTS.INQUIRY_STATUS_UPDATED]: () => {
				void fetchInquiry();
			},
		}
	);

	if (isLoading) {
		return (
			<div className="max-w-4xl mx-auto p-6 text-center py-20">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
			</div>
		);
	}

	if (error || !data) {
		return (
			<div className="max-w-4xl mx-auto p-6 text-center py-20">
				<div className="text-error mb-4">{error || "문의를 찾을 수 없습니다."}</div>
				<button onClick={() => router.back()} className="btn btn-secondary">
					뒤로 가기
				</button>
			</div>
		);
	}

	return (
		<div className="max-w-4xl mx-auto p-6">
			<div className="mb-6 flex items-center gap-3">
				<Link href="/" className="btn btn-secondary btn-sm">
					← 메인
				</Link>
				<button
					onClick={() => router.back()}
					className="text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
				>
					<span>←</span> 목록으로 돌아가기
				</button>
			</div>

			<InquiryDetail
				inquiry={data.inquiry}
				replies={data.replies}
				currentUserId={Number(sessionUser?.id ?? 0)}
				currentUserRole={sessionUser?.role ?? "user"}
			/>
		</div>
	);
}
