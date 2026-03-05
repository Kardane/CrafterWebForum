"use client";

/**
 * 댓글 섹션 오케스트레이터 컴포넌트
 * 트리 조작은 comment-tree-ops, API는 useCommentMutations, 스크롤은 useCommentScroll로 위임
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { Pin } from "lucide-react";
import CommentItem from "./CommentItem";
import CommentForm from "./CommentForm";
import PinnedCommentsModal from "./PinnedCommentsModal";
import CommentDateDividerRow from "./CommentDateDividerRow";
import ReadMarkerRow from "./ReadMarkerRow";
import ThreadToggleRow from "./ThreadToggleRow";
import {
	buildInitialCommentViewState,
	hasCommentId,
	parseRealtimeComment,
	toDateKey,
	toDateLabel,
} from "./comment-section-helpers";
import { commentSectionStyles } from "./comment-section.styles";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { OPEN_PINNED_COMMENTS_EVENT, SCROLL_COMMENT_FEED_BOTTOM_EVENT } from "@/constants/comments";
import {
	flattenCommentsForStream,
	toReplyPreview,
	type FlattenedStreamComment,
} from "@/lib/comment-stream";
import { extractMentionNicknames } from "@/lib/mentions";
import { toSessionUserId } from "@/lib/session-user";
import { text } from "@/lib/system-text";
import {
	appendReplyToThread,
	type Comment,
	LATEST_CHUNK_SIZE,
	THREAD_COLLAPSE_THRESHOLD,
	getReadMarkerIndex,
	removeCommentFromTree,
	updateCommentInTree,
	updateCommentPinnedInTree,
} from "@/lib/comment-tree-ops";
import { useCommentMutations } from "./useCommentMutations";
import { useCommentScroll } from "./useCommentScroll";
import { useRealtimeBroadcast } from "@/lib/realtime/useRealtimeBroadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";

interface CommentSectionProps {
	postId: number;
	initialComments: Comment[];
	initialCommentsPage?: {
		limit: number;
		nextCursor: number | null;
		hasMore: boolean;
	};
	readMarker?: {
		lastReadCommentCount: number;
		totalCommentCount: number;
	};
}

interface ReplyTarget {
	parentId: number;
	nickname: string;
	preview?: string;
}

type FlattenedComment = FlattenedStreamComment<Comment>;

interface PinnedCommentItem {
	id: number;
	authorNickname: string;
	createdAt: string;
	preview: string;
}

type RenderRow =
	| { type: "date-divider"; key: string; label: string }
	| { type: "read-marker"; key: string }
	| { type: "comment"; key: string; item: FlattenedComment }
	| { type: "thread-toggle"; key: string; rootId: number; replyCount: number; isCollapsed: boolean };

const COMPOSER_RESERVE_HEIGHT = 220;

export default function CommentSection({
	postId,
	initialComments,
	initialCommentsPage,
	readMarker,
}: CommentSectionProps) {
	const { data: session } = useSession();
	const { showToast } = useToast();
	const [readMarkerState, setReadMarkerState] = useState(readMarker);
	const [typingUsers, setTypingUsers] = useState<string[]>([]);
	const [initialViewState] = useState(() =>
		buildInitialCommentViewState(initialComments, readMarker?.lastReadCommentCount ?? 0)
	);
	const [comments, setComments] = useState<Comment[]>(initialComments);
	const [commentsPage, setCommentsPage] = useState<{
		limit: number;
		nextCursor: number | null;
		hasMore: boolean;
	}>(() => ({
		limit: initialCommentsPage?.limit ?? 12,
		nextCursor: initialCommentsPage?.nextCursor ?? null,
		hasMore: initialCommentsPage?.hasMore ?? false,
	}));
	const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
	const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
	const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);
	const [isPinnedModalOpen, setIsPinnedModalOpen] = useState(false);
	const [visibleStart, setVisibleStart] = useState(initialViewState.visibleStart);
	const [expandedThreadRoots, setExpandedThreadRoots] = useState<Set<number>>(
		() => new Set(initialViewState.expandedThreadRoots)
	);
	const [requestedEditCommentId, setRequestedEditCommentId] = useState<number | null>(null);
	const headerRef = useRef<HTMLDivElement>(null);
	const streamRef = useRef<HTMLDivElement>(null);
	const composerShellRef = useRef<HTMLDivElement>(null);
	const [composerDockInsets, setComposerDockInsets] = useState<{ left: number; right: number } | null>(null);

	// --- 파생 데이터 ---
	const flattenedComments = useMemo(() => flattenCommentsForStream(comments), [comments]);
	const sessionUserId = toSessionUserId(session?.user?.id);

	const latestOwnCommentId = useMemo(() => {
		if (!sessionUserId) return null;
		for (let i = flattenedComments.length - 1; i >= 0; i -= 1) {
			if (flattenedComments[i].comment.author.id === sessionUserId) {
				return flattenedComments[i].comment.id;
			}
		}
		return null;
	}, [flattenedComments, sessionUserId]);

	const mentionedCommentIds = useMemo(() => {
		const me = session?.user?.nickname?.trim();
		if (!me) {
			return new Set<number>();
		}
		const matched = new Set<number>();
		for (const item of flattenedComments) {
			const mentions = extractMentionNicknames(item.comment.content);
			if (mentions.some((nickname) => nickname === me)) {
				matched.add(item.comment.id);
			}
		}
		return matched;
	}, [flattenedComments, session?.user?.nickname]);

	const threadReplyCounts = useMemo(() => {
		const counts = new Map<number, number>();
		for (const item of flattenedComments) {
			if (item.comment.parentId !== null) {
				counts.set(item.threadRootId, (counts.get(item.threadRootId) ?? 0) + 1);
			}
		}
		return counts;
	}, [flattenedComments]);

	const readMarkerIndex = useMemo(
		() => getReadMarkerIndex(flattenedComments.length, readMarkerState?.lastReadCommentCount ?? 0),
		[flattenedComments.length, readMarkerState?.lastReadCommentCount]
	);

	const reloadComments = useCallback(async () => {
		try {
			const response = await fetch(`/api/posts/${postId}/comments`, { cache: "no-store" });
			if (!response.ok) {
				return;
			}
			const data = (await response.json()) as { comments?: Comment[] };
			if (Array.isArray(data.comments)) {
				setComments(data.comments);
			}
		} catch {
			return;
		}
	}, [postId]);

	const pinnedComments = useMemo<PinnedCommentItem[]>(
		() =>
			flattenedComments
				.filter((item) => item.comment.isPinned)
				.map((item) => ({
					id: item.comment.id,
					authorNickname: item.comment.author.nickname,
					createdAt: item.comment.createdAt,
					preview: toReplyPreview(item.comment.content),
				})),
		[flattenedComments]
	);

	const effectiveVisibleStart = useMemo(() => {
		const total = flattenedComments.length;
		if (total === 0) {
			return 0;
		}
		const maxStart = Math.max(0, total - 1);
		return Math.min(Math.max(0, visibleStart), maxStart);
	}, [flattenedComments.length, visibleStart]);

	const hasBufferedOlderComments = effectiveVisibleStart > 0;
	const hasOlderComments = hasBufferedOlderComments || commentsPage.hasMore;
	const olderLoadCount = hasBufferedOlderComments
		? Math.min(LATEST_CHUNK_SIZE, effectiveVisibleStart)
		: commentsPage.limit;

	// --- 스레드 접기/펼치기 ---
	const isThreadCollapsible = useCallback(
		(rootId: number) => (threadReplyCounts.get(rootId) ?? 0) >= THREAD_COLLAPSE_THRESHOLD,
		[threadReplyCounts]
	);

	const isThreadCollapsed = useCallback(
		(rootId: number) => isThreadCollapsible(rootId) && !expandedThreadRoots.has(rootId),
		[expandedThreadRoots, isThreadCollapsible]
	);

	const ensureCommentVisible = useCallback(
		(commentId: number): boolean => {
			const targetIndex = flattenedComments.findIndex((item) => item.comment.id === commentId);
			if (targetIndex < 0) return false;
			setVisibleStart((prev) => (targetIndex >= prev ? prev : Math.max(0, targetIndex - 2)));
			const targetItem = flattenedComments[targetIndex];
			if (
				targetItem.comment.parentId !== null &&
				isThreadCollapsible(targetItem.threadRootId) &&
				!expandedThreadRoots.has(targetItem.threadRootId)
			) {
				setExpandedThreadRoots((prev) => {
					const next = new Set(prev);
					next.add(targetItem.threadRootId);
					return next;
				});
			}
			return true;
		},
		[expandedThreadRoots, flattenedComments, isThreadCollapsible]
	);

	// --- 훅 위임 ---
	const { scrollToBottom, scrollToCommentElement } = useCommentScroll({
		postId,
		streamRef,
		ensureCommentVisible,
		flattenedCommentsLength: flattenedComments.length,
	});

	const {
		isLoading,
		handleCommentCreate,
		handleCommentUpdate,
		handleCommentDeleteConfirmed,
		handleCommentPinToggle,
	} = useCommentMutations({
		postId,
		session,
		setComments,
		setReplyTarget,
		setExpandedThreadRoots,
		setPendingDeleteId,
	});

	// --- 렌더 행 구성 ---
	const renderRows = useMemo<RenderRow[]>(() => {
		const rows: RenderRow[] = [];
		let previousDateKey: string | null = null;
		for (let i = effectiveVisibleStart; i < flattenedComments.length; i += 1) {
			const item = flattenedComments[i];
			if (isThreadCollapsed(item.threadRootId) && item.comment.parentId !== null) continue;
			const currentDateKey = toDateKey(item.comment.createdAt);
			if (currentDateKey !== previousDateKey) {
				rows.push({
					type: "date-divider",
					key: `date-divider-${currentDateKey}-${i}`,
					label: toDateLabel(item.comment.createdAt),
				});
				previousDateKey = currentDateKey;
			}
			if (readMarkerIndex !== null && i === readMarkerIndex) {
				rows.push({ type: "read-marker", key: `read-marker-${i}` });
			}
			rows.push({ type: "comment", key: `comment-${item.comment.id}`, item });
			if (item.comment.id !== item.threadRootId) continue;
			const replyCount = threadReplyCounts.get(item.threadRootId) ?? 0;
			if (replyCount < THREAD_COLLAPSE_THRESHOLD) continue;
			rows.push({
				type: "thread-toggle",
				key: `thread-toggle-${item.threadRootId}`,
				rootId: item.threadRootId,
				replyCount,
				isCollapsed: isThreadCollapsed(item.threadRootId),
			});
		}
		return rows;
	}, [effectiveVisibleStart, flattenedComments, isThreadCollapsed, readMarkerIndex, threadReplyCounts]);

	// --- 이벤트/이펙트 ---
	useEffect(() => {
		const openPinnedModal = () => setIsPinnedModalOpen(true);
		const scrollFeedBottom = () => scrollToBottom("smooth");
		window.addEventListener(OPEN_PINNED_COMMENTS_EVENT, openPinnedModal);
		window.addEventListener(SCROLL_COMMENT_FEED_BOTTOM_EVENT, scrollFeedBottom);
		return () => {
			window.removeEventListener(OPEN_PINNED_COMMENTS_EVENT, openPinnedModal);
			window.removeEventListener(SCROLL_COMMENT_FEED_BOTTOM_EVENT, scrollFeedBottom);
		};
	}, [scrollToBottom]);

	useRealtimeBroadcast(REALTIME_TOPICS.post(postId), {
		[REALTIME_EVENTS.COMMENT_CREATED]: (payload) => {
			const actorUserId = Number(payload.actorUserId ?? 0);
			const me = Number(session?.user?.id ?? 0);
			if (actorUserId > 0 && actorUserId === me) {
				return;
			}
			const nextComment = parseRealtimeComment(payload);
			if (!nextComment) {
				void reloadComments();
				return;
			}
			setComments((prev) => {
				if (hasCommentId(prev, nextComment.id)) {
					return prev;
				}
				if (nextComment.parentId === null) {
					return [...prev, nextComment];
				}
				if (!hasCommentId(prev, nextComment.parentId)) {
					void reloadComments();
					return prev;
				}
				return appendReplyToThread(prev, nextComment.parentId, nextComment);
			});
		},
		[REALTIME_EVENTS.COMMENT_UPDATED]: (payload) => {
			const nextComment = parseRealtimeComment(payload);
			if (nextComment) {
				setComments((prev) => updateCommentInTree(prev, nextComment.id, nextComment.content, nextComment.updatedAt));
				return;
			}
			const commentId = Number(payload.commentId ?? 0);
			const content = typeof payload.content === "string" ? payload.content : "";
			const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : "";
			if (!Number.isInteger(commentId) || commentId <= 0 || !content || !updatedAt) {
				void reloadComments();
				return;
			}
			setComments((prev) => updateCommentInTree(prev, commentId, content, updatedAt));
		},
		[REALTIME_EVENTS.COMMENT_DELETED]: (payload) => {
			const commentId = Number(payload.commentId ?? 0);
			if (!Number.isInteger(commentId) || commentId <= 0) {
				void reloadComments();
				return;
			}
			setComments((prev) => removeCommentFromTree(prev, commentId));
		},
		[REALTIME_EVENTS.COMMENT_PINNED_CHANGED]: (payload) => {
			const commentId = Number(payload.commentId ?? 0);
			const isPinned = Boolean(payload.isPinned);
			if (!Number.isInteger(commentId) || commentId <= 0) {
				void reloadComments();
				return;
			}
			setComments((prev) => updateCommentPinnedInTree(prev, commentId, isPinned));
		},
		[REALTIME_EVENTS.COMMENT_TYPING_CHANGED]: (payload) => {
			const actorUserId = Number(payload.userId ?? 0);
			const me = Number(session?.user?.id ?? 0);
			if (actorUserId > 0 && actorUserId === me) {
				return;
			}
			const nickname = String(payload.nickname ?? "누군가");
			const isTyping = Boolean(payload.typing);
			setTypingUsers((prev) => {
				if (isTyping) {
					if (prev.includes(nickname)) {
						return prev;
					}
					return [...prev, nickname];
				}
				return prev.filter((name) => name !== nickname);
			});
		},
	});

	useRealtimeBroadcast(
		sessionUserId ? REALTIME_TOPICS.user(sessionUserId) : null,
		{
			[REALTIME_EVENTS.POST_READ_MARKER_UPDATED]: (payload) => {
				const nextPostId = Number(payload.postId ?? 0);
				if (nextPostId !== postId) {
					return;
				}
				const lastReadCommentCount = Number(payload.lastReadCommentCount ?? 0);
				const totalCommentCount = Number(payload.totalCommentCount ?? 0);
				setReadMarkerState({
					lastReadCommentCount: Number.isFinite(lastReadCommentCount) ? lastReadCommentCount : 0,
					totalCommentCount: Number.isFinite(totalCommentCount) ? totalCommentCount : flattenedComments.length,
				});
			},
		}
	);

	useEffect(() => {
		const header = headerRef.current;
		if (!header) {
			return;
		}

		let rafId: number | null = null;
		const measure = () => {
			const nextHeader = headerRef.current;
			if (!nextHeader) {
				return;
			}
			const rect = nextHeader.getBoundingClientRect();
			const left = Math.max(0, Math.floor(rect.left));
			const right = Math.max(0, Math.floor(window.innerWidth - rect.right));
			setComposerDockInsets((prev) => (prev && prev.left === left && prev.right === right ? prev : { left, right }));
		};
		const scheduleMeasure = () => {
			if (rafId) {
				window.cancelAnimationFrame(rafId);
			}
			rafId = window.requestAnimationFrame(measure);
		};

		scheduleMeasure();
		window.addEventListener("resize", scheduleMeasure);
		const observer = new ResizeObserver(scheduleMeasure);
		observer.observe(header);

		return () => {
			window.removeEventListener("resize", scheduleMeasure);
			observer.disconnect();
			if (rafId) {
				window.cancelAnimationFrame(rafId);
			}
		};
	}, []);

	// --- 핸들러 ---
	const handleReplyRequest = (commentId: number, nickname: string, preview: string) => {
		setReplyTarget({ parentId: commentId, nickname, preview });
		requestAnimationFrame(() => {
			const input = document.getElementById("comment-composer-input");
			if (input instanceof HTMLTextAreaElement) input.focus();
		});
	};

	const handleNavigateToComment = (commentId: number) => {
		if (!ensureCommentVisible(commentId)) {
			showToast({ type: "error", message: "원본 댓글을 찾을 수 없음" });
			return;
		}
		const { pathname, search } = window.location;
		window.history.replaceState(null, "", `${pathname}${search}#comment-${commentId}`);
		requestAnimationFrame(() => scrollToCommentElement(commentId, true, setHighlightedCommentId));
	};

	const handlePinnedCommentSelect = (commentId: number) => {
		setIsPinnedModalOpen(false);
		requestAnimationFrame(() => handleNavigateToComment(commentId));
	};

	const handleRequestEditLatestOwnComment = () => {
		if (!latestOwnCommentId) {
			showToast({ type: "error", message: "수정 가능한 내 댓글이 없음" });
			return;
		}
		if (!ensureCommentVisible(latestOwnCommentId)) {
			showToast({ type: "error", message: "대상 댓글을 찾지 못함" });
			return;
		}
		setRequestedEditCommentId(latestOwnCommentId);
		requestAnimationFrame(() => scrollToCommentElement(latestOwnCommentId, true, setHighlightedCommentId));
	};

	const handleLoadOlderComments = useCallback(async () => {
		if (hasBufferedOlderComments) {
			setVisibleStart((prev) => Math.max(0, prev - LATEST_CHUNK_SIZE));
			return;
		}
		if (!commentsPage.hasMore || commentsPage.nextCursor === null) {
			return;
		}

		try {
			const params = new URLSearchParams();
			params.set("limit", String(commentsPage.limit));
			params.set("cursor", String(commentsPage.nextCursor));
			const response = await fetch(`/api/posts/${postId}/comments?${params.toString()}`, {
				cache: "no-store",
			});
			if (!response.ok) {
				return;
			}
			const data = (await response.json()) as {
				comments?: Comment[];
				page?: {
					limit: number;
					nextCursor: number | null;
					hasMore: boolean;
				};
			};
			if (!Array.isArray(data.comments)) {
				return;
			}
			const olderComments = data.comments;
			setComments((prev) => {
				const existingRootIds = new Set(prev.map((comment) => comment.id));
				const olderRoots = olderComments.filter((comment) => !existingRootIds.has(comment.id));
				return [...olderRoots, ...prev];
			});
			if (data.page) {
				setCommentsPage({
					limit: data.page.limit,
					nextCursor: data.page.nextCursor,
					hasMore: data.page.hasMore,
				});
			}
		} catch {
			return;
		}
	}, [commentsPage.hasMore, commentsPage.limit, commentsPage.nextCursor, hasBufferedOlderComments, postId]);

	const handleTypingStateChange = useCallback(
		(typing: boolean) => {
			void fetch(`/api/realtime/comment-typing`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ postId, typing }),
			});
		},
		[postId]
	);

	const handleToggleThread = (rootId: number) => {
		setExpandedThreadRoots((prev) => {
			const next = new Set(prev);
			if (next.has(rootId)) next.delete(rootId);
			else next.add(rootId);
			return next;
		});
	};

	// --- JSX ---
	return (
		<div className="comment-section">
			<div className="comment-section-header" ref={headerRef}>
				<h2 className="text-xl font-bold">댓글 {flattenedComments.length}개</h2>
				{typingUsers.length > 0 && <span className="text-xs text-text-muted">{typingUsers.join(", ")} 입력 중...</span>}
				<button
					type="button"
					className="btn btn-secondary btn-sm pinned-list-btn"
					onClick={() => setIsPinnedModalOpen(true)}
				>
					<Pin size={14} />
					고정 댓글{pinnedComments.length > 0 ? ` ${pinnedComments.length}` : ""}
				</button>
			</div>

			<div className="comment-stream" ref={streamRef}>
				<div className="comment-list" style={{ paddingBottom: `${COMPOSER_RESERVE_HEIGHT}px` }}>
					{hasOlderComments && (
						<div className="older-loader">
							<button type="button" className="btn btn-secondary btn-sm" onClick={handleLoadOlderComments}>
								이전 댓글 {olderLoadCount}개 보기
							</button>
						</div>
					)}

					{renderRows.length === 0 ? (
						<div className="py-8 text-center text-text-muted">첫 댓글 써줘</div>
					) : (
						renderRows.map((row) => {
							if (row.type === "date-divider") {
								return (
									<div className="comment-row" key={row.key}>
										<CommentDateDividerRow label={row.label} />
									</div>
								);
							}
							if (row.type === "read-marker") {
								return (
									<div className="comment-row" key={row.key}>
										<ReadMarkerRow rowKey={row.key} />
									</div>
								);
							}
							if (row.type === "thread-toggle") {
								return (
									<div className="comment-row" key={row.key}>
										<ThreadToggleRow
											rowKey={row.key}
											rootId={row.rootId}
											replyCount={row.replyCount}
											isCollapsed={row.isCollapsed}
											onToggle={handleToggleThread}
										/>
									</div>
								);
							}
							return (
								<div className="comment-row" key={row.key}>
									<CommentItem
										comment={row.item.comment}
										replyToName={row.item.replyToName}
										replyToCommentId={row.item.replyToCommentId}
										replyToPreview={row.item.replyToPreview}
										threadRootId={row.item.threadRootId}
										isCompact={row.item.isCompact}
										isHighlighted={highlightedCommentId === row.item.comment.id}
										isMentionHighlighted={mentionedCommentIds.has(row.item.comment.id)}
										shouldStartEdit={requestedEditCommentId === row.item.comment.id}
										onEditRequestConsumed={(cId) =>
											setRequestedEditCommentId((prev) => (prev === cId ? null : prev))
										}
										onNavigateToComment={handleNavigateToComment}
										onReplyRequest={handleReplyRequest}
										onEdit={handleCommentUpdate}
										onPin={handleCommentPinToggle}
										onDelete={(cId, event) => {
											if (event?.shiftKey) void handleCommentDeleteConfirmed(cId, pendingDeleteId);
											else setPendingDeleteId(cId);
										}}
										disabled={isLoading}
									/>
								</div>
							);
						})
					)}
					<div id="comment-feed-end" />
				</div>
			</div>

			<div
				className="composer-dock"
				style={
					composerDockInsets
						? {
							left: composerDockInsets.left,
							right: composerDockInsets.right,
							paddingLeft: 0,
							paddingRight: 0,
						}
						: undefined
				}
			>
				<div className="composer-shell" id="comment-composer" ref={composerShellRef}>
					<CommentForm
						onSubmit={(content) => handleCommentCreate(content, replyTarget?.parentId ?? null)}
						onTypingStateChange={handleTypingStateChange}
						onRequestEditLatestOwnComment={handleRequestEditLatestOwnComment}
						disabled={isLoading}
						variant="composer"
						replyTo={replyTarget?.nickname}
						replyPreview={replyTarget?.preview}
						onCancel={replyTarget ? () => setReplyTarget(null) : undefined}
						placeholder={replyTarget ? "답장 작성 중..." : "댓글을 입력해줘"}
						textareaId="comment-composer-input"
						postId={postId}
					/>
				</div>
			</div>

			<PinnedCommentsModal
				isOpen={isPinnedModalOpen}
				onClose={() => setIsPinnedModalOpen(false)}
				pinnedComments={pinnedComments}
				onSelect={handlePinnedCommentSelect}
			/>

			<Modal
				isOpen={pendingDeleteId !== null}
				onClose={() => setPendingDeleteId(null)}
				onEnter={() => void handleCommentDeleteConfirmed(undefined, pendingDeleteId)}
				title={text("comment.deleteTitle")}
				size="sm"
				variant="sidebarLike"
				footer={
					<div className="flex justify-end gap-2">
						<button type="button" className="btn btn-secondary btn-sm" onClick={() => setPendingDeleteId(null)}>
							{text("comment.cancelButton")}
						</button>
						<button
							type="button"
							className="btn btn-danger btn-sm"
							onClick={() => void handleCommentDeleteConfirmed(undefined, pendingDeleteId)}
						>
							{text("comment.deleteButton")}
						</button>
					</div>
				}
			>
				<p className="text-sm text-text-secondary">{text("comment.deleteConfirm")}</p>
			</Modal>

			<style jsx>{commentSectionStyles}</style>
		</div>
	);
}
