"use client";

import { useEffect, useState } from "react";
import { AdminStats } from "@/types/admin";

export default function AdminDashboardTab() {
	const [stats, setStats] = useState<AdminStats | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				const res = await fetch("/api/admin/stats", { cache: "no-store" });
				if (!res.ok) throw new Error("Failed to load stats");
				const data = await res.json();
				setStats(data.stats);
			} catch (e) {
				console.error(e);
				setError("관리자 통계를 불러오지 못했습니다");
			}
		})();
	}, []);

	if (error) return <p className="text-error">{error}</p>;
	if (!stats) return <p className="text-text-muted">불러오는 중...</p>;

	return (
		<div>
			<h2 className="mb-4 text-xl font-semibold">개요</h2>
			<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{[
					["유저", stats.users],
					["포스트", stats.posts],
					["댓글", stats.comments],
					["문의", stats.inquiries],
					["승인대기 유저", stats.pendingUsers],
					["미응답 문의", stats.pendingInquiries],
				].map(([label, value]) => (
					<div key={label} className="rounded-lg border border-border bg-bg-tertiary/40 p-4">
						<p className="text-sm text-text-muted">{label}</p>
						<p className="mt-1 text-2xl font-bold">{value}</p>
					</div>
				))}
			</div>
		</div>
	);
}
