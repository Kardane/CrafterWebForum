"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AdminPostRow } from "@/types/admin";

function formatDate(date: string) {
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return "-";
	return parsed.toLocaleString("ko-KR");
}

export default function AdminPostsTab() {
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
			setError("포스트 목록을 불러오지 못했습니다");
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

	if (loading) return <p className="text-text-muted">불러오는 중...</p>;
	if (error) return <p className="text-error">{error}</p>;

	return (
		<div>
			<h2 className="mb-4 text-xl font-semibold">포스트</h2>
			<div className="overflow-x-auto">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="border-b border-border text-left">
							<th className="py-2 pr-3">ID</th>
							<th className="py-2 pr-3">제목</th>
							<th className="py-2 pr-3">작성자</th>
							<th className="py-2 pr-3">작성일</th>
							<th className="py-2 pr-3">작업</th>
						</tr>
					</thead>
					<tbody>
						{posts.map((post) => (
							<tr key={post.id} className="border-b border-border/60">
								<td className="py-2 pr-3">{post.id}</td>
								<td className="py-2 pr-3">{post.title}</td>
								<td className="py-2 pr-3">{post.authorName}</td>
								<td className="py-2 pr-3">{formatDate(post.createdAt)}</td>
								<td className="py-2 pr-3">
									<div className="flex flex-wrap gap-1">
										{post.deletedAt ? (
											<span className="text-xs text-text-muted">삭제됨</span>
										) : (
											<>
												<Link href={`/posts/${post.id}`} className="btn btn-secondary btn-sm">
													해당 포스트로 이동
												</Link>
												<button
													className="btn btn-danger btn-sm"
													onClick={() => {
														void deletePost(post.id).catch((e) => {
															console.error(e);
															alert("포스트 삭제에 실패했습니다");
														});
													}}
												>
													삭제
												</button>
											</>
										)}
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
