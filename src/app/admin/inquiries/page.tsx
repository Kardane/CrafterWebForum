"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminInquiryRow } from "@/types/admin";

export default function AdminInquiriesPage() {
	const [inquiries, setInquiries] = useState<AdminInquiryRow[]>([]);
	const [replyDraft, setReplyDraft] = useState<Record<number, string>>({});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadInquiries = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/inquiries", { cache: "no-store" });
			if (!res.ok) throw new Error("Failed to load inquiries");
			const data = await res.json();
			setInquiries(
				(data.inquiries ?? []).map(
					(i: {
						id: number;
						title: string;
						status: string;
						createdAt: string;
						authorName: string;
						authorId?: number;
					}) => ({
						id: i.id,
						title: i.title,
						status: i.status,
						createdAt: i.createdAt,
						authorId: i.authorId ?? 0,
						authorName: i.authorName,
					})
				)
			);
			setError(null);
		} catch (e) {
			console.error(e);
			setError("Failed to load inquiries.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadInquiries();
	}, [loadInquiries]);

	const reply = async (id: number) => {
		const content = (replyDraft[id] ?? "").trim();
		if (!content) {
			alert("Reply content is required.");
			return;
		}

		const res = await fetch(`/api/admin/inquiries/${id}/reply`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ content }),
		});
		if (!res.ok) throw new Error("Failed to reply");

		setReplyDraft((prev) => ({ ...prev, [id]: "" }));
		await loadInquiries();
	};

	const removeInquiry = async (id: number) => {
		const res = await fetch(`/api/admin/inquiries/${id}`, { method: "DELETE" });
		if (!res.ok) throw new Error("Failed to delete inquiry");
		await loadInquiries();
	};

	if (loading) return <p className="text-text-muted">Loading...</p>;
	if (error) return <p className="text-error">{error}</p>;

	return (
		<div>
			<h2 className="text-xl font-semibold mb-4">Inquiries</h2>
			<div className="space-y-3">
				{inquiries.map((inq) => (
					<div key={inq.id} className="border border-border rounded-lg p-4">
						<div className="flex items-center justify-between gap-2">
							<div>
								<p className="font-semibold">{inq.title}</p>
								<p className="text-xs text-text-muted">
									#{inq.id} by {inq.authorName} at{" "}
									{new Date(inq.createdAt).toLocaleString()}
								</p>
							</div>
							<span
								className={`text-xs px-2 py-1 rounded ${
									inq.status === "answered"
										? "bg-success text-white"
										: "bg-warning text-black"
								}`}
							>
								{inq.status}
							</span>
						</div>

						<div className="mt-3">
							<textarea
								value={replyDraft[inq.id] ?? ""}
								onChange={(e) =>
									setReplyDraft((prev) => ({ ...prev, [inq.id]: e.target.value }))
								}
								className="input-base w-full h-24"
								placeholder="Write admin reply..."
							/>
							<div className="mt-2 flex justify-end">
								<button
									className="btn btn-danger btn-sm mr-2"
									onClick={() => {
										void removeInquiry(inq.id).catch((e) => {
											console.error(e);
											alert("Failed to delete inquiry.");
										});
									}}
								>
									Delete
								</button>
								<button
									className="btn btn-primary btn-sm"
									onClick={() => {
										void reply(inq.id).catch((e) => {
											console.error(e);
											alert("Failed to submit reply.");
										});
									}}
								>
									Reply
								</button>
							</div>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
