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
	const [archivedPosts, setArchivedPosts] = useState<AdminPostRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadPosts = useCallback(async () => {
		setLoading(true);
		try {
			const [activeRes, archivedRes] = await Promise.all([
				fetch("/api/admin/posts", { cache: "no-store" }),
				fetch("/api/admin/posts?archived=true", { cache: "no-store" }),
			]);
			if (!activeRes.ok || !archivedRes.ok) {
				throw new Error("Failed to load posts");
			}
			const [activeData, archivedData] = await Promise.all([
				activeRes.json(),
				archivedRes.json(),
			]);
			setPosts((activeData.posts ?? []) as AdminPostRow[]);
			setArchivedPosts((archivedData.posts ?? []) as AdminPostRow[]);
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

	const archivePost = async (id: number) => {
		const res = await fetch(`/api/admin/posts/${id}`, { method: "DELETE" });
		if (!res.ok) throw new Error("Failed to delete post");
		await loadPosts();
	};

	const restorePost = async (id: number) => {
		const res = await fetch(`/api/admin/posts/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action: "restore" }),
		});
		if (!res.ok) throw new Error("Failed to restore post");
		await loadPosts();
	};

	const permanentlyDeletePost = async (id: number) => {
		const res = await fetch(`/api/admin/posts/${id}?permanent=true`, {
			method: "DELETE",
		});
		if (!res.ok) throw new Error("Failed to permanently delete post");
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
						{posts.length === 0 && (
							<tr>
								<td colSpan={5} className="py-6 text-center text-text-muted">
									표시할 포스트가 없습니다
								</td>
							</tr>
						)}
						{posts.map((post) => (
							<tr key={post.id} className="border-b border-border/60">
								<td className="py-2 pr-3">{post.id}</td>
								<td className="py-2 pr-3">{post.title}</td>
								<td className="py-2 pr-3">{post.authorName}</td>
								<td className="py-2 pr-3">{formatDate(post.createdAt)}</td>
								<td className="py-2 pr-3">
									<div className="flex flex-wrap gap-1">
										<Link href={`/posts/${post.id}`} className="btn btn-secondary btn-sm">
											이동
										</Link>
										<button
											className="btn btn-danger btn-sm"
											onClick={() => {
												if (!window.confirm("이 포스트를 아카이브할까요?")) {
													return;
												}
												void archivePost(post.id).catch((e) => {
													console.error(e);
													alert("포스트 아카이브에 실패했습니다");
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
					아카이브된 포스트 {archivedPosts.length}개
				</summary>
				<div className="mt-4 overflow-x-auto">
					<table className="w-full border-collapse text-sm">
						<thead>
							<tr className="border-b border-border text-left">
								<th className="py-2 pr-3">ID</th>
								<th className="py-2 pr-3">제목</th>
								<th className="py-2 pr-3">작성자</th>
								<th className="py-2 pr-3">아카이브일</th>
								<th className="py-2 pr-3">작업</th>
							</tr>
						</thead>
						<tbody>
							{archivedPosts.length === 0 && (
								<tr>
									<td colSpan={5} className="py-6 text-center text-text-muted">
										아카이브된 포스트가 없습니다
									</td>
								</tr>
							)}
							{archivedPosts.map((post) => (
								<tr key={post.id} className="border-b border-border/60">
									<td className="py-2 pr-3">{post.id}</td>
									<td className="py-2 pr-3">{post.title}</td>
									<td className="py-2 pr-3">{post.authorName}</td>
									<td className="py-2 pr-3">{formatDate(post.deletedAt ?? "")}</td>
									<td className="py-2 pr-3">
										<div className="flex flex-wrap gap-1">
											<button
												className="btn btn-secondary btn-sm"
												onClick={() => {
													void restorePost(post.id).catch((e) => {
														console.error(e);
														alert("포스트 복구에 실패했습니다");
													});
												}}
											>
												복구
											</button>
											<button
												className="btn btn-danger btn-sm"
												onClick={() => {
													if (!window.confirm("이 포스트를 영구 삭제할까요?")) {
														return;
													}
													void permanentlyDeletePost(post.id).catch((e) => {
														console.error(e);
														alert("포스트 영구 삭제에 실패했습니다");
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
