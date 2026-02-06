"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPostRow } from "@/types/admin";

function formatDate(date: string) {
	return new Date(date).toLocaleString();
}

export default function AdminPostsPage() {
	const [posts, setPosts] = useState<AdminPostRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadPosts = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/admin/posts", { cache: "no-store" });
			if (!res.ok) throw new Error("Failed to load posts");
			const data = await res.json();
			const mapped: AdminPostRow[] = data.posts ?? [];
			setPosts(mapped);
			setError(null);
		} catch (e) {
			console.error(e);
			setError("Failed to load posts.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadPosts();
	}, [loadPosts]);

	const deletePost = async (id: number) => {
		const res = await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });
		if (!res.ok) throw new Error("Failed to delete post");
		await loadPosts();
	};

	if (loading) return <p className="text-text-muted">Loading...</p>;
	if (error) return <p className="text-error">{error}</p>;

	return (
		<div>
			<h2 className="text-xl font-semibold mb-4">Posts</h2>
			<div className="overflow-x-auto">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border text-left">
							<th className="py-2 pr-3">ID</th>
							<th className="py-2 pr-3">Title</th>
							<th className="py-2 pr-3">Author</th>
							<th className="py-2 pr-3">Created</th>
							<th className="py-2 pr-3">Actions</th>
						</tr>
					</thead>
					<tbody>
						{posts.map((p) => (
							<tr key={p.id} className="border-b border-border/60">
								<td className="py-2 pr-3">{p.id}</td>
								<td className="py-2 pr-3">{p.title}</td>
								<td className="py-2 pr-3">{p.authorName}</td>
								<td className="py-2 pr-3">{formatDate(p.createdAt)}</td>
								<td className="py-2 pr-3">
									{p.deletedAt ? (
										<span className="text-xs text-text-muted">Already deleted</span>
									) : (
										<button
											className="btn btn-danger btn-sm"
											onClick={() => {
												void deletePost(p.id).catch((e) => {
													console.error(e);
													alert("Failed to delete post.");
												});
											}}
										>
											Delete
										</button>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
