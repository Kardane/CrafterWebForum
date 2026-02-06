"use client";

import { useEffect, useState } from "react";
import { AdminStats } from "@/types/admin";

export default function AdminDashboardPage() {
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
				setError("Failed to load admin stats.");
			}
		})();
	}, []);

	if (error) return <p className="text-error">{error}</p>;
	if (!stats) return <p className="text-text-muted">Loading...</p>;

	return (
		<div>
			<h2 className="text-xl font-semibold mb-4">Overview</h2>
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{[
					["Users", stats.users],
					["Posts", stats.posts],
					["Comments", stats.comments],
					["Inquiries", stats.inquiries],
					["Pending Users", stats.pendingUsers],
					["Pending Inquiries", stats.pendingInquiries],
				].map(([label, value]) => (
					<div key={label} className="border border-border rounded-lg p-4 bg-bg-tertiary/40">
						<p className="text-sm text-text-muted">{label}</p>
						<p className="text-2xl font-bold mt-1">{value}</p>
					</div>
				))}
			</div>
		</div>
	);
}

