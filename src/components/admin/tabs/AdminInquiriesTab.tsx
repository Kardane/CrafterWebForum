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
	if (status === "answered") {
		return "답변 완료";
	}
	if (status === "closed") {
		return "종료됨";
	}
	return "대기 중";
}

function statusClass(status: string) {
	if (status === "closed") {
		return "border border-border bg-bg-tertiary text-text-secondary";
	}
	return status === "answered"
		? "border border-success/40 bg-success/20 text-success"
		: "border border-warning/40 bg-warning/20 text-warning";
}

export default function AdminInquiriesTab() {
	const [inquiries, setInquiries] = useState<AdminInquiryRow[]>([]);
	const [archivedInquiries, setArchivedInquiries] = useState<AdminInquiryRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadInquiries = useCallback(async () => {
		setLoading(true);
		try {
			const [activeRes, archivedRes] = await Promise.all([
				fetch("/api/admin/inquiries", { cache: "no-store" }),
				fetch("/api/admin/inquiries?archived=true", { cache: "no-store" }),
			]);
			if (
				activeRes.status === 401 ||
				archivedRes.status === 401 ||
				activeRes.status === 403 ||
				archivedRes.status === 403
			) {
				window.location.href = "/login?callbackUrl=/admin";
				return;
			}
			if (!activeRes.ok || !archivedRes.ok) {
				throw new Error("Failed to load inquiries");
			}
			const [activeData, archivedData] = await Promise.all([
				activeRes.json(),
				archivedRes.json(),
			]);
			setInquiries((activeData.inquiries ?? []) as AdminInquiryRow[]);
			setArchivedInquiries((archivedData.inquiries ?? []) as AdminInquiryRow[]);
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

	const archiveInquiry = async (id: number) => {
		const res = await fetch(`/api/admin/inquiries/${id}`, { method: "DELETE" });
		if (!res.ok) throw new Error("Failed to delete inquiry");
		await loadInquiries();
	};

	const restoreInquiry = async (id: number) => {
		const res = await fetch(`/api/admin/inquiries/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "restore" }),
		});
		if (!res.ok) throw new Error("Failed to restore inquiry");
		await loadInquiries();
	};

	const permanentlyDeleteInquiry = async (id: number) => {
		const res = await fetch(`/api/admin/inquiries/${id}?permanent=true`, {
			method: "DELETE",
		});
		if (!res.ok) throw new Error("Failed to permanently delete inquiry");
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
						{inquiries.length === 0 && (
							<tr>
								<td colSpan={6} className="py-6 text-center text-text-muted">
									표시할 문의가 없습니다
								</td>
							</tr>
						)}
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
											이동
										</Link>
										<button
											className="btn btn-danger btn-sm"
											onClick={() => {
												if (!window.confirm("이 문의를 아카이브할까요?")) {
													return;
												}
												void archiveInquiry(inquiry.id).catch((e) => {
													console.error(e);
													alert("문의 아카이브에 실패했습니다");
												});
											}}
										>
											아카이브
										</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<details className="mt-6 rounded-lg border border-border bg-bg-tertiary/30 p-4">
				<summary className="cursor-pointer text-sm font-semibold text-text-secondary">
					아카이브된 문의 {archivedInquiries.length}개
				</summary>
				<div className="mt-4 overflow-x-auto">
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr className="border-b border-border text-left">
								<th className="py-2 pr-3">ID</th>
								<th className="py-2 pr-3">제목</th>
								<th className="py-2 pr-3">작성자</th>
								<th className="py-2 pr-3">상태</th>
								<th className="py-2 pr-3">아카이브일</th>
								<th className="py-2 pr-3">작업</th>
							</tr>
						</thead>
						<tbody>
							{archivedInquiries.length === 0 && (
								<tr>
									<td colSpan={6} className="py-6 text-center text-text-muted">
										아카이브된 문의가 없습니다
									</td>
								</tr>
							)}
							{archivedInquiries.map((inquiry) => (
								<tr key={inquiry.id} className="border-b border-border/60">
									<td className="py-2 pr-3">{inquiry.id}</td>
									<td className="py-2 pr-3">{inquiry.title}</td>
									<td className="py-2 pr-3">{inquiry.authorName}</td>
									<td className="py-2 pr-3">
										<span
											className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(inquiry.status)}`}
										>
											{statusLabel(inquiry.status)}
										</span>
									</td>
									<td className="py-2 pr-3">{formatDate(inquiry.archivedAt ?? "")}</td>
									<td className="py-2 pr-3">
										<div className="flex flex-wrap gap-1">
											<button
												className="btn btn-secondary btn-sm"
												onClick={() => {
													void restoreInquiry(inquiry.id).catch((e) => {
														console.error(e);
														alert("문의 복구에 실패했습니다");
													});
												}}
											>
												복구
											</button>
											<button
												className="btn btn-danger btn-sm"
												onClick={() => {
													if (!window.confirm("이 문의를 영구 삭제할까요?")) {
														return;
													}
													void permanentlyDeleteInquiry(inquiry.id).catch((e) => {
														console.error(e);
														alert("문의 영구 삭제에 실패했습니다");
													});
												}}
											>
												영구 삭제
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</details>
		</div>
	);
}
