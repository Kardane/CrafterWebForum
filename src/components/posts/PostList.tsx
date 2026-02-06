"use client";

import { useRouter, useSearchParams } from "next/navigation";
import PostCard from "./PostCard";
import { Button } from "@/components/ui/Button";

interface Post {
	id: number;
	title: string;
	content: string;
	authorName: string;
	authorUuid?: string;
	createdAt: string;
	views: number;
	likes: number;
	commentCount: number;
	tags: string[];
	unreadCount?: number;
}

interface PostListProps {
	posts: Post[];
	totalPages: number;
	currentPage: number;
}

export default function PostList({ posts, totalPages, currentPage }: PostListProps) {
	const router = useRouter();
	const searchParams = useSearchParams();

	const handlePageChange = (page: number) => {
		const params = new URLSearchParams(searchParams.toString());
		params.set("page", page.toString());
		router.push(`/?${params.toString()}`);
	};

	if (posts.length === 0) {
		return (
			<div className="py-20 text-center text-text-muted bg-bg-secondary rounded-lg border border-bg-tertiary border-dashed">
				<div className="text-4xl mb-4 opacity-50">📭</div>
				<h3 className="text-lg font-bold text-text-primary mb-2">포스트가 없습니다</h3>
				<p>필터 조건을 변경하거나 첫 번째 글을 작성해보세요!</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			{/* 포스트 목록 */}
			<div className="grid gap-3">
				{posts.map((post) => (
					<PostCard
						key={post.id}
						id={post.id}
						title={post.title}
						content={post.content}
						authorName={post.authorName}
						authorUuid={post.authorUuid}
						createdAt={post.createdAt}
						viewCount={post.views}
						likeCount={post.likes}
						commentCount={post.commentCount}
						tags={post.tags}
						unreadCount={post.unreadCount}
					/>
				))}
			</div>

			{/* 페이지네이션 */}
			{totalPages > 1 && (
				<div className="flex justify-center items-center gap-2 mt-4">
					<Button
						variant="secondary"
						size="sm"
						disabled={currentPage <= 1}
						onClick={() => handlePageChange(currentPage - 1)}
					>
						이전
					</Button>

					<div className="flex gap-1">
						{Array.from({ length: totalPages }, (_, i) => i + 1)
							.filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
							.map((p, i, arr) => {
								const prev = arr[i - 1];
								const showEllipsis = prev && p - prev > 1;

								return (
									<div key={p} className="flex items-center">
										{showEllipsis && <span className="px-2 text-text-muted">...</span>}
										<Button
											variant={p === currentPage ? "primary" : "ghost"}
											size="sm"
											className={p === currentPage ? "" : "text-text-secondary"}
											onClick={() => handlePageChange(p)}
										>
											{p}
										</Button>
									</div>
								);
							})}
					</div>

					<Button
						variant="secondary"
						size="sm"
						disabled={currentPage >= totalPages}
						onClick={() => handlePageChange(currentPage + 1)}
					>
						다음
					</Button>
				</div>
			)}
		</div>
	);
}
