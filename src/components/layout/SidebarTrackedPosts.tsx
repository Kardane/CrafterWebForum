"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import classNames from "classnames";
import { useSession } from "next-auth/react";
import { Bell, BellOff, Loader2, MessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/useToast";
import { useRealtimeBroadcast } from "@/lib/realtime/useRealtimeBroadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";
import type { SidebarTrackedPost } from "@/types/sidebar";

interface SidebarTrackedPostsProps {
	onNavigate?: () => void;
}

interface SidebarTrackedPostsResponse {
	items?: SidebarTrackedPost[];
	page?: {
		nextCursor?: string | null;
		hasMore?: boolean;
	};
}

const DEFAULT_FETCH_LIMIT = 30;

interface SidebarTrackedPostsFallbackItem {
	title: string;
	href: string;
	author: {
		nickname: string;
		minecraftUuid: string | null;
	};
	commentCount: number;
	latestCommentId: number | null;
}

interface SidebarTrackedPostsFallbackChangeDetail {
	postId: number;
	enabled: boolean;
	item?: SidebarTrackedPostsFallbackItem;
}

interface PostSubscriptionToggleResponse {
	fallbackLocalOnly?: boolean;
}

function buildFallbackTrackedPost(postId: number, item: SidebarTrackedPostsFallbackItem): SidebarTrackedPost {
	return {
		postId,
		title: item.title,
		href: item.href,
		lastActivityAt: new Date().toISOString(),
		author: {
			nickname: item.author.nickname,
			minecraftUuid: item.author.minecraftUuid,
		},
		sourceFlags: {
			authored: false,
			subscribed: true,
		},
		isSubscribed: true,
		commentCount: item.commentCount,
		newCommentCount: 0,
		latestCommentId: item.latestCommentId,
	};
}

function sortTrackedPosts(rows: SidebarTrackedPost[]): SidebarTrackedPost[] {
	return [...rows].sort((a, b) => {
		const aTime = new Date(a.lastActivityAt).getTime();
		const bTime = new Date(b.lastActivityAt).getTime();
		if (aTime !== bTime) {
			return bTime - aTime;
		}
		return b.postId - a.postId;
	});
}

function parsePostId(payload: Record<string, unknown>): number | null {
	const parsed = Number(payload.postId ?? 0);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return null;
	}
	return parsed;
}

function mergeTrackedPosts(existing: SidebarTrackedPost[], incoming: SidebarTrackedPost[]): SidebarTrackedPost[] {
	const map = new Map<number, SidebarTrackedPost>();
	for (const row of existing) {
		map.set(row.postId, row);
	}
	for (const row of incoming) {
		map.set(row.postId, row);
	}
	return sortTrackedPosts(Array.from(map.values()));
}

function normalizeVisibleTrackedPosts(rows: SidebarTrackedPost[]): SidebarTrackedPost[] {
	return sortTrackedPosts(rows.filter((item) => item.isSubscribed && item.sourceFlags.subscribed));
}

export default function SidebarTrackedPosts({ onNavigate }: SidebarTrackedPostsProps) {
	const pathname = usePathname();
	const { data: session } = useSession();
	const sessionUserId = Number(session?.user?.id ?? 0);
	const { showToast } = useToast();

	const [items, setItems] = useState<SidebarTrackedPost[]>([]);
	const [fallbackLocalItems, setFallbackLocalItems] = useState<SidebarTrackedPost[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [hasMore, setHasMore] = useState(false);
	const [isInitialLoading, setIsInitialLoading] = useState(false);
	const [isLoadingMore, setIsLoadingMore] = useState(false);
	const [pendingTogglePostIds, setPendingTogglePostIds] = useState<number[]>([]);
	const hasShownFetchErrorToastRef = useRef(false);
	const fallbackLocalItemsRef = useRef<SidebarTrackedPost[]>([]);

	useEffect(() => {
		fallbackLocalItemsRef.current = fallbackLocalItems;
	}, [fallbackLocalItems]);

	const refreshTrackedPosts = useCallback(async () => {
		if (!sessionUserId) {
			setItems([]);
			setFallbackLocalItems([]);
			setNextCursor(null);
			setHasMore(false);
			return;
		}

		setIsInitialLoading(true);
		try {
			const response = await fetch(`/api/sidebar/tracked-posts?limit=${DEFAULT_FETCH_LIMIT}`, {
				cache: "no-store",
			});
			if (!response.ok) {
				throw new Error(`failed_to_fetch:${response.status}`);
			}
			const payload = (await response.json()) as SidebarTrackedPostsResponse;
			const rows = Array.isArray(payload.items) ? payload.items : [];
			setItems(normalizeVisibleTrackedPosts(rows));
			setNextCursor(payload.page?.nextCursor ?? null);
			setHasMore(Boolean(payload.page?.hasMore));
			hasShownFetchErrorToastRef.current = false;
		} catch (error) {
			console.error("[sidebar] failed to refresh tracked posts", error);
			setItems(normalizeVisibleTrackedPosts(fallbackLocalItemsRef.current));
			if (!hasShownFetchErrorToastRef.current) {
				hasShownFetchErrorToastRef.current = true;
				showToast({ type: "error", message: "사이드바 포스트 목록을 불러오지 못했음" });
			}
		} finally {
			setIsInitialLoading(false);
		}
	}, [sessionUserId, showToast]);

	const loadMoreTrackedPosts = useCallback(async () => {
		if (!sessionUserId || !hasMore || !nextCursor || isLoadingMore) {
			return;
		}

		setIsLoadingMore(true);
		try {
			const response = await fetch(
				`/api/sidebar/tracked-posts?limit=${DEFAULT_FETCH_LIMIT}&cursor=${encodeURIComponent(nextCursor)}`,
				{ cache: "no-store" }
			);
			if (!response.ok) {
				throw new Error(`failed_to_fetch_more:${response.status}`);
			}
			const payload = (await response.json()) as SidebarTrackedPostsResponse;
			const rows = Array.isArray(payload.items) ? payload.items : [];
			setItems((previous) => {
				const mergedRows = mergeTrackedPosts(previous, rows);
				return normalizeVisibleTrackedPosts(mergedRows);
			});
			setNextCursor(payload.page?.nextCursor ?? null);
			setHasMore(Boolean(payload.page?.hasMore));
			hasShownFetchErrorToastRef.current = false;
		} catch (error) {
			console.error("[sidebar] failed to load more tracked posts", error);
			if (!hasShownFetchErrorToastRef.current) {
				hasShownFetchErrorToastRef.current = true;
				showToast({ type: "error", message: "추가 목록을 불러오지 못했음" });
			}
		} finally {
			setIsLoadingMore(false);
		}
	}, [hasMore, isLoadingMore, nextCursor, sessionUserId, showToast]);

	const setTogglePending = useCallback((postId: number, pending: boolean) => {
		setPendingTogglePostIds((previous) => {
			if (pending) {
				if (previous.includes(postId)) {
					return previous;
				}
				return [...previous, postId];
			}
			return previous.filter((value) => value !== postId);
		});
	}, []);

	const togglePostSubscription = useCallback(
		async (postId: number, enabled: boolean) => {
			if (!sessionUserId) {
				return;
			}
			setTogglePending(postId, true);
			try {
				const response = await fetch(`/api/posts/${postId}/subscription`, {
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ enabled }),
				});
				if (!response.ok) {
					throw new Error(`failed_to_toggle:${response.status}`);
				}
				const payload = (await response.json()) as PostSubscriptionToggleResponse;
				setFallbackLocalItems((previous) => {
					if (!payload.fallbackLocalOnly) {
						return previous.filter((item) => item.postId !== postId);
					}
					if (!enabled) {
						return previous.filter((item) => item.postId !== postId);
					}

					const baseItem =
						previous.find((item) => item.postId === postId) ??
						items.find((item) => item.postId === postId);
					if (!baseItem) {
						return previous;
					}

					return normalizeVisibleTrackedPosts(
						mergeTrackedPosts(previous, [
							{
								...baseItem,
								lastActivityAt: new Date().toISOString(),
								sourceFlags: {
									...baseItem.sourceFlags,
									subscribed: true,
								},
								isSubscribed: true,
							},
						])
					);
				});
				setItems((previous) => {
					const updated = previous.map((item) => {
						if (item.postId !== postId) {
							return item;
						}
						return {
							...item,
							isSubscribed: enabled,
							sourceFlags: {
								...item.sourceFlags,
								subscribed: enabled,
							},
						};
					});
					return normalizeVisibleTrackedPosts(updated);
				});

				if (!payload.fallbackLocalOnly) {
					void refreshTrackedPosts();
				}
				showToast({
					type: "success",
					message: enabled ? "포스트 알림 켰음" : "포스트 알림 껐음",
				});
			} catch (error) {
				console.error("[sidebar] failed to toggle post subscription", error);
				showToast({ type: "error", message: "알림 설정 변경 실패" });
			} finally {
				setTogglePending(postId, false);
			}
		},
		[items, refreshTrackedPosts, sessionUserId, setTogglePending, showToast]
	);

	useEffect(() => {
		void refreshTrackedPosts();
	}, [pathname, refreshTrackedPosts]);

	useEffect(() => {
		if (!sessionUserId) {
			return;
		}

		const handleTrackedPostsChanged = () => {
			void refreshTrackedPosts();
		};
		const handleFallbackChanged = (event: Event) => {
			const detail = (event as CustomEvent<SidebarTrackedPostsFallbackChangeDetail>).detail;
			if (!detail || !Number.isInteger(detail.postId) || detail.postId <= 0) {
				return;
			}

			if (detail.enabled) {
				if (!detail.item) {
					return;
				}
				const fallbackItem = buildFallbackTrackedPost(detail.postId, detail.item);
				setFallbackLocalItems((previous) => normalizeVisibleTrackedPosts(mergeTrackedPosts(previous, [fallbackItem])));
				setItems((previous) => normalizeVisibleTrackedPosts(mergeTrackedPosts(previous, [fallbackItem])));
				return;
			}

			setFallbackLocalItems((previous) => previous.filter((item) => item.postId !== detail.postId));
			setItems((previous) => normalizeVisibleTrackedPosts(previous.filter((item) => item.postId !== detail.postId)));
		};

		window.addEventListener("sidebarTrackedPostsChanged", handleTrackedPostsChanged);
		window.addEventListener("sidebarTrackedPostsFallbackChanged", handleFallbackChanged as EventListener);
		return () => {
			window.removeEventListener("sidebarTrackedPostsChanged", handleTrackedPostsChanged);
			window.removeEventListener("sidebarTrackedPostsFallbackChanged", handleFallbackChanged as EventListener);
		};
	}, [refreshTrackedPosts, sessionUserId]);

	useEffect(() => {
		if (!sessionUserId) {
			return;
		}

		const handleFocus = () => {
			void refreshTrackedPosts();
		};
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void refreshTrackedPosts();
			}
		};

		window.addEventListener("focus", handleFocus);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			window.removeEventListener("focus", handleFocus);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [refreshTrackedPosts, sessionUserId]);

	useRealtimeBroadcast(sessionUserId ? REALTIME_TOPICS.user(sessionUserId) : null, {
		[REALTIME_EVENTS.NOTIFICATION_CREATED]: (payload) => {
			const type = String(payload.type ?? "");
			if (type !== "post_comment") {
				return;
			}
			const postId = parsePostId(payload);
			if (!postId) {
				return;
			}
			setItems((previous) => {
				let changed = false;
				const updated = previous.map((item) => {
					if (item.postId !== postId) {
						return item;
					}
					changed = true;
					return {
						...item,
						newCommentCount: item.newCommentCount + 1,
						lastActivityAt: new Date().toISOString(),
					};
				});
				if (!changed) {
					return previous;
				}
				return sortTrackedPosts(updated);
			});
		},
		[REALTIME_EVENTS.POST_READ_MARKER_UPDATED]: (payload) => {
			const postId = parsePostId(payload);
			if (!postId) {
				return;
			}
			const totalCommentCount = Number(payload.totalCommentCount ?? NaN);
			const lastReadCommentCount = Number(payload.lastReadCommentCount ?? NaN);
			if (!Number.isFinite(totalCommentCount) || !Number.isFinite(lastReadCommentCount)) {
				return;
			}
			const unreadCount = Math.max(totalCommentCount - lastReadCommentCount, 0);
			setItems((previous) =>
				previous.map((item) => {
					if (item.postId !== postId) {
						return item;
					}
					return {
						...item,
						newCommentCount: unreadCount,
					};
				})
			);
		},
	});

	const pendingSet = useMemo(() => new Set(pendingTogglePostIds), [pendingTogglePostIds]);

	return (
		<div className="flex h-full flex-col">
			<div className="mb-2 px-2 text-[11px] font-semibold tracking-wide text-text-muted">구독 중 포스트</div>

			{isInitialLoading && items.length === 0 ? (
				<div className="px-2 py-4 text-xs text-text-muted">목록 불러오는 중...</div>
			) : null}

			{!isInitialLoading && items.length === 0 ? (
				<div className="px-2 py-4 text-xs text-text-muted">구독 중인 포스트가 아직 없음</div>
			) : null}

			<div className="space-y-1 overflow-y-auto pr-1">
				{items.map((item) => {
					const isPending = pendingSet.has(item.postId);
					const targetHref = item.latestCommentId
						? `${item.href}?commentId=${item.latestCommentId}#comment-${item.latestCommentId}`
						: item.href;
					return (
						<div
							key={item.postId}
							className="flex items-start gap-2 rounded border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-bg-tertiary"
						>
							<Link
								href={targetHref}
								onClick={onNavigate}
								className="min-w-0 flex-1"
								title={item.title}
							>
								<div className="flex items-start gap-2">
									<div className="min-w-0 flex-1">
										<div className="truncate text-sm text-text-primary">{item.title}</div>
										<div className="mt-0.5 truncate text-[11px] text-text-muted">{item.author.nickname}</div>
									</div>
								</div>
								<div className="mt-1 flex flex-wrap items-center gap-1.5">
									{item.newCommentCount > 0 && (
										<span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
											<MessageSquare size={10} />
											{item.newCommentCount > 99 ? "99+" : item.newCommentCount}
										</span>
									)}
								</div>
							</Link>

							<div className="mt-0.5 flex items-center gap-1">
								<span className="inline-flex items-center gap-1 rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] text-text-secondary">
									<MessageSquare size={10} />
									{item.commentCount > 999 ? "999+" : item.commentCount}
								</span>
								<button
									type="button"
									onClick={() => void togglePostSubscription(item.postId, !item.isSubscribed)}
									disabled={isPending}
									className={classNames(
										"inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
										item.isSubscribed
											? "text-accent hover:bg-bg-secondary"
											: "text-text-muted hover:bg-bg-secondary hover:text-text-primary",
										isPending ? "cursor-wait opacity-70" : ""
									)}
									title={item.isSubscribed ? "포스트 알림 끄기" : "포스트 알림 켜기"}
								>
									{isPending ? (
										<Loader2 size={14} className="animate-spin" />
									) : item.isSubscribed ? (
										<Bell size={14} />
									) : (
										<BellOff size={14} />
									)}
								</button>
							</div>
						</div>
					);
				})}
			</div>

			{hasMore && (
				<button
					type="button"
					onClick={() => void loadMoreTrackedPosts()}
					disabled={isLoadingMore}
					className="mt-2 rounded border border-border px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary disabled:cursor-wait disabled:opacity-70"
				>
					{isLoadingMore ? "불러오는 중..." : "더 보기"}
				</button>
			)}
		</div>
	);
}
