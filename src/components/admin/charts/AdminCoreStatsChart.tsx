"use client";

import { AdminCoreTrendPoint } from "@/types/admin";

interface AdminCoreStatsChartProps {
	points: AdminCoreTrendPoint[];
	rangeLabel: string;
}

const ITEM_COLORS: Record<"users" | "posts" | "comments", string> = {
	users: "#8B2332",
	posts: "#4D7999",
	comments: "#5A8B5A",
};

const LABELS: Record<"users" | "posts" | "comments", string> = {
	users: "유저",
	posts: "포스트",
	comments: "댓글",
};

const SERIES_KEYS = ["users", "posts", "comments"] as const;

function toShortLabel(dateKey: string) {
	const [, month, day] = dateKey.split("-");
	return `${month}-${day}`;
}

function buildLinePath(
	points: AdminCoreTrendPoint[],
	seriesKey: (typeof SERIES_KEYS)[number],
	maxValue: number,
	width: number,
	height: number,
	padding: { top: number; right: number; bottom: number; left: number }
) {
	const plotWidth = width - padding.left - padding.right;
	const plotHeight = height - padding.top - padding.bottom;

	return points
		.map((point, index) => {
			const x =
				points.length === 1
					? padding.left + plotWidth / 2
					: padding.left + (plotWidth * index) / (points.length - 1);
			const y = padding.top + plotHeight - (plotHeight * point[seriesKey]) / maxValue;
			return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
		})
		.join(" ");
}

function getY(value: number, maxValue: number, chartHeight: number, chartPaddingTop: number, chartPaddingBottom: number) {
	const plotHeight = chartHeight - chartPaddingTop - chartPaddingBottom;
	return chartPaddingTop + plotHeight - (plotHeight * value) / maxValue;
}

export default function AdminCoreStatsChart({ points, rangeLabel }: AdminCoreStatsChartProps) {
	if (!points || points.length === 0) {
		return null;
	}

	const chartWidth = 720;
	const chartHeight = 260;
	const chartPadding = { top: 18, right: 20, bottom: 38, left: 36 };
	const maxValue = Math.max(
		1,
		...points.flatMap((point) => [point.users, point.posts, point.comments])
	);
	const yTickValues = Array.from(
		new Set([0, 0.25, 0.5, 0.75, 1].map((ratio) => Math.round(maxValue * ratio)))
	).sort((a, b) => a - b);
	const xTickStep = Math.max(1, Math.floor(points.length / 8));
	const latestPoint = points[points.length - 1];

	return (
		<section className="mb-4 rounded-lg border border-border bg-bg-tertiary/40 p-4 text-white">
			<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h3 className="text-sm font-semibold text-white">
					핵심 통계 추이 ({rangeLabel})
				</h3>
				<div className="flex flex-wrap items-center gap-3 text-xs">
					{SERIES_KEYS.map((key) => (
						<div key={key} className="inline-flex items-center gap-1.5 text-white/90">
							<span
								className="h-2.5 w-2.5 rounded-full"
								style={{ backgroundColor: ITEM_COLORS[key] }}
								aria-hidden
							/>
							<span>{LABELS[key]}</span>
							<span className="font-semibold text-white">
								{latestPoint[key].toLocaleString()}
							</span>
						</div>
					))}
				</div>
			</div>

			<div className="overflow-x-auto">
				<svg
					viewBox={`0 0 ${chartWidth} ${chartHeight}`}
					className="h-[230px] min-w-[640px] w-full"
					role="img"
					aria-label="유저 포스트 댓글 일자별 누적 통계 선그래프"
				>
					{yTickValues.map((value) => (
						<g key={value}>
							<line
								x1={chartPadding.left}
								x2={chartWidth - chartPadding.right}
								y1={getY(value, maxValue, chartHeight, chartPadding.top, chartPadding.bottom)}
								y2={getY(value, maxValue, chartHeight, chartPadding.top, chartPadding.bottom)}
								stroke="color-mix(in srgb, var(--border) 80%, transparent)"
								strokeWidth="1"
							/>
							<text
								x={chartPadding.left - 8}
								y={getY(value, maxValue, chartHeight, chartPadding.top, chartPadding.bottom) + 4}
								textAnchor="end"
								fontSize="10"
								fill="#ffffff"
							>
								{value.toLocaleString()}
							</text>
						</g>
					))}

					{SERIES_KEYS.map((seriesKey) => (
						<path
							key={seriesKey}
							d={buildLinePath(points, seriesKey, maxValue, chartWidth, chartHeight, chartPadding)}
							fill="none"
							stroke={ITEM_COLORS[seriesKey]}
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					))}

					{points.map((point, index) => {
						const x =
							points.length === 1
								? chartPadding.left + (chartWidth - chartPadding.left - chartPadding.right) / 2
								: chartPadding.left +
								  ((chartWidth - chartPadding.left - chartPadding.right) * index) /
										(points.length - 1);
						const shouldShowLabel = index % xTickStep === 0 || index === points.length - 1;
						if (!shouldShowLabel) {
							return null;
						}
						return (
							<text
								key={point.date}
								x={x}
								y={chartHeight - 12}
								textAnchor="middle"
								fontSize="10"
								fill="#ffffff"
							>
								{toShortLabel(point.date)}
							</text>
						);
					})}
				</svg>
			</div>
		</section>
	);
}
