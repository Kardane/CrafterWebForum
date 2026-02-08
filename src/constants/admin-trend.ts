export const ADMIN_TREND_RANGE_DAYS = {
	"3d": 3,
	"7d": 7,
	"14d": 14,
	"30d": 30,
	"90d": 90,
	"180d": 180,
} as const;

export type AdminTrendRangeKey = keyof typeof ADMIN_TREND_RANGE_DAYS;

export const DEFAULT_ADMIN_TREND_RANGE: AdminTrendRangeKey = "14d";

export const ADMIN_TREND_RANGE_OPTIONS: Array<{
	key: AdminTrendRangeKey;
	label: string;
}> = [
	{ key: "3d", label: "3일" },
	{ key: "7d", label: "7일" },
	{ key: "14d", label: "14일" },
	{ key: "30d", label: "1달" },
	{ key: "90d", label: "3달" },
	{ key: "180d", label: "6달" },
];
