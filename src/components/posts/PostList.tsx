"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PostCard from "./PostCard";
import { readHomeScrollState, saveHomeScrollState } from "@/lib/scroll-restore";
import { text } from "@/lib/system-text";

interface Post {
	id: number;
	title: string;
	content: string;
	authorName: string;
	authorUuid?: string | null;
	createdAt: string;
	updatedAt: string;
	views: number;
	likes: number;
	commentCount: number;
	tags: string[];
	unreadCount?: number;
	userLiked?: boolean;
}

interface PostListProps {
	initialPosts: Post[];
	totalPages: number;
	initialPage: number;
	initialLimit: number;
}

interface PostsResponse {
	posts: Post[];
	metadata: {
		total: number;
		page: number;
		limit: number;
		totalPages: number;
	};
}

export default function PostList({
	initialPosts,
	totalPages,
	initialPage,
	initialLimit,
}: PostListProps) {
	const searchParams = useSearchParams();
	const searchQuery = searchParams.toString();
	const sentinelRef = useRef<HTMLDivElement | null>(null);
	const [posts, setPosts] = useState<Post[]>(initialPosts);
	const [currentPage, setCurrentPage] = useState(initialPage);
	const [hasMore, setHasMore] = useState(initialPage < totalPages);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [loadError, setLoadError] = useState<string | null>(null);

	useEffect(() => {
		const savedScrollY = readHomeScrollState(searchQuery);
		if (savedScrollY === null) {
			return;
		}
		requestAnimationFrame(() => {
			window.scrollTo({ top: savedScrollY, behavior: "auto" });
		});
	}, [searchQuery]);

	useEffect(() => {
		setPosts(initialPosts);
		setCurrentPage(initialPage);
		setHasMore(initialPage < totalPages);
		setIsLoadingMore(false);
		setLoadError(null);
	}, [initialPosts, initialPage, totalPages, searchQuery]);

	const baseParams = useMemo(() => {
		const params = new URLSearchParams(searchParams.toString());
		params.delete("page");
		if (!params.get("limit")) {
			params.set("limit", String(initialLimit));
		}
		return params;
	}, [searchParams, initialLimit]);

	const loadNextPage = useCallback(async () => {
		if (!hasMore || isLoadingMore) {
			return;
		}

		setIsLoadingMore(true);
		setLoadError(null);
		const nextPage = currentPage + 1;
		const nextParams = new URLSearchParams(baseParams.toString());
		nextParams.set("page", String(nextPage));

		try {
			const response = await fetch(`/api/posts?${nextParams.toString()}`, {
				cache: "no-store",
			});
			if (!response.ok) {
				throw new Error(`failed_to_fetch_next_page_${response.status}`);
			}
			const data = (await response.json()) as PostsResponse;
			setPosts((prev) => {
				const existingIds = new Set(prev.map((post) => post.id));
				const nextPosts = data.posts.filter((post) => !existingIds.has(post.id));
				return [...prev, ...nextPosts];
			});
			setCurrentPage(data.metadata.page);
			setHasMore(data.metadata.page < data.metadata.totalPages);
		} catch (error) {
			console.error("Infinite post loading error:", error);
			setLoadError(text("home.loadMoreFailed"));
		} finally {
			setIsLoadingMore(false);
		}
	}, [baseParams, currentPage, hasMore, isLoadingMore]);

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel || !hasMore) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					void loadNextPage();
				}
			},
			{
				rootMargin: "400px 0px",
			}
		);

		observer.observe(sentinel);
		return () => {
			observer.disconnect();
		};
	}, [hasMore, loadNextPage]);

	const handlePostNavigate = (postId: number) => {
		saveHomeScrollState(searchQuery, window.scrollY);
		setPosts((prev) =>
			prev.map((post) =>
				post.id === postId ? { ...post, unreadCount: 0 } : post
			)
		);
	};

	if (posts.length === 0) {
		return (
			<div className="py-20 text-center text-text-muted bg-bg-secondary rounded-lg border border-bg-tertiary border-dashed">
				<div className="text-4xl mb-4 opacity-50">📭</div>
				<h3 className="text-lg font-bold text-text-primary mb-2">{text("home.emptyTitle")}</h3>
				<p>{text("home.emptyDescription")}</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-6">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				{posts.map((post) => (
					<PostCard
						key={post.id}
						id={post.id}
						title={post.title}
						content={post.content}
						authorName={post.authorName}
						authorUuid={post.authorUuid}
						createdAt={post.createdAt}
						updatedAt={post.updatedAt}
						viewCount={post.views}
						likeCount={post.likes}
							commentCount={post.commentCount}
							tags={post.tags}
							unreadCount={post.unreadCount}
							userLiked={post.userLiked}
							onNavigate={handlePostNavigate}
					/>
				))}
			</div>

			<div ref={sentinelRef} className="h-px" aria-hidden />

			{isLoadingMore && (
				<div className="py-3 text-center text-sm text-text-secondary">
					{text("home.loadingMore")}
				</div>
			)}

			{loadError && (
				<div className="py-3 text-center text-sm text-error">
					<div>{loadError}</div>
					<button
						type="button"
						className="mt-2 btn btn-secondary btn-sm"
						onClick={() => {
							void loadNextPage();
						}}
					>
						{text("home.retry")}
					</button>
				</div>
			)}

			{!hasMore && totalPages > 1 && (
				<div className="py-2 text-center text-xs text-text-muted">
					{text("home.allLoaded")}
				</div>
			)}
		</div>
	);
}
