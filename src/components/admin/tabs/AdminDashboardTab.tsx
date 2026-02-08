"use client";

import { useEffect, useState } from "react";
import classNames from "classnames";
import { AdminStats } from "@/types/admin";
import AdminCoreStatsChart from "@/components/admin/charts/AdminCoreStatsChart";
import {
	ADMIN_TREND_RANGE_OPTIONS,
	DEFAULT_ADMIN_TREND_RANGE,
	type AdminTrendRangeKey,
} from "@/constants/admin-trend";

export default function AdminDashboardTab() {
	const [stats, setStats] = useState<AdminStats | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [trendRange, setTrendRange] = useState<AdminTrendRangeKey>(DEFAULT_ADMIN_TREND_RANGE);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		(async () => {
			try {
				const res = await fetch(`/api/admin/stats?range=${trendRange}`, { cache: "no-store" });
				if (res.status === 401 || res.status === 403) {
					if (!cancelled) {
						window.location.href = "/login?callbackUrl=/admin";
					}
					return;
				}
				if (!res.ok) {
					throw new Error("FAILED_TO_LOAD_STATS");
				}
				const data = await res.json();
				if (!cancelled) {
					setStats(data.stats);
					setError(null);
				}
			} catch (e) {
				console.error(e);
				if (!cancelled) {
					setError("관리자 통계를 불러오지 못했습니다");
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [trendRange]);

	const selectedRangeLabel =
		ADMIN_TREND_RANGE_OPTIONS.find((option) => option.key === trendRange)?.label ?? "14일";

	return (
		<div>
			<h2 className="mb-4 text-xl font-semibold">개요</h2>
			<div className="mb-4 flex flex-wrap gap-2">
				{ADMIN_TREND_RANGE_OPTIONS.map((option) => {
					const isActive = trendRange === option.key;
					return (
						<button
							key={option.key}
							type="button"
							aria-pressed={isActive}
							className={classNames(
								"rounded-md border px-3 py-1.5 text-sm transition-colors",
								isActive
									? "border-accent bg-accent/15 text-text-primary"
									: "border-border bg-bg-tertiary text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
							)}
							onClick={() => {
								setTrendRange(option.key);
							}}
						>
							{option.label}
						</button>
					);
				})}
			</div>
			{error && <p className="mb-3 text-error">{error}</p>}
			{loading && !stats && <p className="text-text-muted">불러오는 중...</p>}
			{!loading && !stats && <p className="text-text-muted">표시할 통계가 없습니다</p>}
			{stats && (
				<>
					<AdminCoreStatsChart points={stats.coreTrend} rangeLabel={selectedRangeLabel} />
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
				</>
			)}
		</div>
	);
}
