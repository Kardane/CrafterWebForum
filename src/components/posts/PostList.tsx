"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import PostCard from "./PostCard";
import { readHomeScrollState, saveHomeScrollState } from "@/lib/scroll-restore";
import { text } from "@/lib/system-text";

interface Post {
	id: number;
	title: string;
	preview: string;
	thumbnailUrl: string | null;
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

const POSTS_PAGE_CACHE_TTL_MS = 45_000;
const postsPageCache = new Map<
	string,
	{
		payload: PostsResponse;
		expiresAt: number;
	}
>();

function normalizePositiveParam(value: string | null, fallback: number): string {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return String(fallback);
	}
	return String(parsed);
}

function buildNormalizedListParams(params: URLSearchParams, initialLimit: number): URLSearchParams {
	const normalized = new URLSearchParams();
	normalized.set("limit", normalizePositiveParam(params.get("limit"), initialLimit));

	const sort = params.get("sort")?.trim();
	if (sort) {
		normalized.set("sort", sort);
	}

	const search = params.get("search")?.trim();
	if (search) {
		normalized.set("search", search);
	}

	const tag = params.get("tag")?.trim();
	if (tag) {
		normalized.set("tag", tag);
	}

	return normalized;
}

function buildPostsPageCacheKey(baseParams: URLSearchParams, page: number) {
	return `${baseParams.toString()}::page=${page}`;
}

function recordPostsCacheMetric(startMark: string, metricName: "posts_cache_hit" | "posts_cache_miss") {
	try {
		if (
			typeof performance === "undefined" ||
			typeof performance.mark !== "function" ||
			typeof performance.measure !== "function"
		) {
			return;
		}
		const endMark = `${startMark}_end`;
		performance.mark(endMark);
		performance.measure(metricName, startMark, endMark);
		performance.clearMarks(startMark);
		performance.clearMarks(endMark);
	} catch {
		// 계측 실패는 사용자 동작에 영향을 주지 않도록 무시
	}
}

export default function PostList({
	initialPosts,
	totalPages,
	initialPage,
	initialLimit,
}: PostListProps) {
	const searchParams = useSearchParams();
	const searchQuery = useMemo(
		() => buildNormalizedListParams(new URLSearchParams(searchParams.toString()), initialLimit).toString(),
		[searchParams, initialLimit]
	);
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

		const initialParams = new URLSearchParams(searchQuery);
		postsPageCache.set(buildPostsPageCacheKey(initialParams, initialPage), {
			payload: {
				posts: initialPosts,
				metadata: {
					total: initialPosts.length,
					page: initialPage,
					limit: initialLimit,
					totalPages,
				},
			},
			expiresAt: Date.now() + POSTS_PAGE_CACHE_TTL_MS,
		});
	}, [initialPosts, initialPage, initialLimit, searchQuery, totalPages]);

	const baseParams = useMemo(() => {
		return new URLSearchParams(searchQuery);
	}, [searchQuery]);

	const loadNextPage = useCallback(async () => {
		if (!hasMore || isLoadingMore) {
			return;
		}

		setIsLoadingMore(true);
		setLoadError(null);
		const nextPage = currentPage + 1;
		const nextParams = new URLSearchParams(baseParams.toString());
		nextParams.set("page", String(nextPage));
		const cacheKey = buildPostsPageCacheKey(baseParams, nextPage);
		const cacheMetricStart = `posts_cache_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		try {
			performance.mark(cacheMetricStart);
		} catch {
			// 계측 시작 실패 시에도 로딩 로직은 유지
		}

		const cached = postsPageCache.get(cacheKey);
		if (cached && cached.expiresAt > Date.now()) {
			const data = cached.payload;
			setPosts((prev) => {
				const existingIds = new Set(prev.map((post) => post.id));
				const nextPosts = data.posts.filter((post) => !existingIds.has(post.id));
				return [...prev, ...nextPosts];
			});
			setCurrentPage(data.metadata.page);
			setHasMore(data.metadata.page < data.metadata.totalPages);
			setIsLoadingMore(false);
			recordPostsCacheMetric(cacheMetricStart, "posts_cache_hit");
			return;
		}
		if (cached && cached.expiresAt <= Date.now()) {
			postsPageCache.delete(cacheKey);
		}

		try {
			const response = await fetch(`/api/posts?${nextParams.toString()}`);
			if (!response.ok) {
				throw new Error(`failed_to_fetch_next_page_${response.status}`);
			}
			const data = (await response.json()) as PostsResponse;
			postsPageCache.set(cacheKey, {
				payload: data,
				expiresAt: Date.now() + POSTS_PAGE_CACHE_TTL_MS,
			});
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
			recordPostsCacheMetric(cacheMetricStart, "posts_cache_miss");
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
						preview={post.preview}
						thumbnailUrl={post.thumbnailUrl}
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
