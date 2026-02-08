"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminInquiryRow } from "@/types/admin";

function formatDate(date: string) {
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return "-";
	return parsed.toLocaleString("ko-KR");
}

function statusLabel(status: string) {
	return status === "answered" ? "답변 완료" : "대기 중";
}

function statusClass(status: string) {
	return status === "answered"
		? "border border-success/40 bg-success/20 text-success"
		: "border border-warning/40 bg-warning/20 text-warning";
}

export default function AdminInquiriesTab() {
	const [inquiries, setInquiries] = useState<AdminInquiryRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadInquiries = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/inquiries", { cache: "no-store" });
			if (!res.ok) throw new Error("Failed to load inquiries");
			const data = await res.json();
			setInquiries(data.inquiries ?? []);
			setError(null);
		} catch (e) {
			console.error(e);
			setError("문의 목록을 불러오지 못했습니다");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadInquiries();
	}, [loadInquiries]);

	const removeInquiry = async (id: number) => {
		const res = await fetch(`/api/admin/inquiries/${id}`, { method: "DELETE" });
		if (!res.ok) throw new Error("Failed to delete inquiry");
		await loadInquiries();
	};

	if (loading) return <p className="text-text-muted">불러오는 중...</p>;
	if (error) return <p className="text-error">{error}</p>;

	return (
		<div>
			<h2 className="mb-4 text-xl font-semibold">문의</h2>
			<div className="overflow-x-auto">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="border-b border-border text-left">
							<th className="py-2 pr-3">ID</th>
							<th className="py-2 pr-3">제목</th>
							<th className="py-2 pr-3">작성자</th>
							<th className="py-2 pr-3">상태</th>
							<th className="py-2 pr-3">작성일</th>
							<th className="py-2 pr-3">작업</th>
						</tr>
					</thead>
					<tbody>
						{inquiries.map((inquiry) => (
							<tr key={inquiry.id} className="border-b border-border/60">
								<td className="py-2 pr-3">{inquiry.id}</td>
								<td className="py-2 pr-3">{inquiry.title}</td>
								<td className="py-2 pr-3">{inquiry.authorName}</td>
								<td className="py-2 pr-3">
									<span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(inquiry.status)}`}>
										{statusLabel(inquiry.status)}
									</span>
								</td>
								<td className="py-2 pr-3">{formatDate(inquiry.createdAt)}</td>
								<td className="py-2 pr-3">
									<div className="flex flex-wrap gap-1">
										<Link href={`/inquiries/${inquiry.id}`} className="btn btn-secondary btn-sm">
											해당 문의로 이동
										</Link>
										<button
											className="btn btn-danger btn-sm"
											onClick={() => {
												void removeInquiry(inquiry.id).catch((e) => {
													console.error(e);
													alert("문의 삭제에 실패했습니다");
												});
											}}
										>
											삭제
										</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
