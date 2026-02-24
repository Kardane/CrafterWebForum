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

interface InitialCommentViewState {
	visibleStart: number;
	expandedThreadRoots: Set<number>;
}

function toDateKey(value: string): string {
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) {
		return "invalid";
	}
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toDateLabel(value: string): string {
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) {
		return "날짜 알 수 없음";
	}
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	const w = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];

	return `${y}년 ${m}월 ${d}일 (${w})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function hasCommentId(nodes: Comment[], commentId: number): boolean {
	for (const node of nodes) {
		if (node.id === commentId) {
			return true;
		}
		if (node.replies.length > 0 && hasCommentId(node.replies, commentId)) {
			return true;
		}
	}
	return false;
}

function parseRealtimeComment(payload: Record<string, unknown>): Comment | null {
	const rawComment = payload.comment;
	if (!isRecord(rawComment)) {
		return null;
	}
	const rawAuthor = rawComment.author;
	if (!isRecord(rawAuthor)) {
		return null;
	}

	const id = Number(rawComment.id);
	const content = typeof rawComment.content === "string" ? rawComment.content : "";
	const createdAt = typeof rawComment.createdAt === "string" ? rawComment.createdAt : "";
	const updatedAt = typeof rawComment.updatedAt === "string" ? rawComment.updatedAt : "";
	const parentIdRaw = rawComment.parentId;
	const parentId = parentIdRaw === null ? null : Number(parentIdRaw);
	const authorId = Number(rawAuthor.id);
	const authorNickname = typeof rawAuthor.nickname === "string" ? rawAuthor.nickname : "";
	const authorRole = typeof rawAuthor.role === "string" ? rawAuthor.role : "user";
	const authorUuid = rawAuthor.minecraftUuid;

	if (!Number.isInteger(id) || id <= 0) {
		return null;
	}
	if (!content || !createdAt || !updatedAt) {
		return null;
	}
	if (parentId !== null && (!Number.isInteger(parentId) || parentId <= 0)) {
		return null;
	}
	if (!Number.isInteger(authorId) || authorId <= 0 || !authorNickname) {
		return null;
	}

	return {
		id,
		content,
		createdAt,
		updatedAt,
		isPinned: Boolean(rawComment.isPinned),
		parentId,
		isPostAuthor: Boolean(rawComment.isPostAuthor),
		author: {
			id: authorId,
			nickname: authorNickname,
			minecraftUuid: typeof authorUuid === "string" ? authorUuid : null,
			role: authorRole,
		},
		replies: [],
	};
}

/**
 * 초기 댓글 뷰 상태 계산
 * - 기본 시작 위치: 최신 댓글 청크
 * - 읽음 마커가 더 앞에 있으면 마커 기준으로 시작
 * - 마커가 접힌 스레드 내부라면 해당 스레드를 초기에 펼침
 */
function buildInitialCommentViewState(initialComments: Comment[], lastReadCommentCount: number): InitialCommentViewState {
	const flattened = flattenCommentsForStream(initialComments);
	const total = flattened.length;
	if (total === 0) {
		return { visibleStart: 0, expandedThreadRoots: new Set<number>() };
	}

	const readMarkerIndex = getReadMarkerIndex(total, lastReadCommentCount);
	const defaultStart = Math.max(0, total - LATEST_CHUNK_SIZE);
	const visibleStart = readMarkerIndex !== null && readMarkerIndex < defaultStart ? readMarkerIndex : defaultStart;
	const expandedThreadRoots = new Set<number>();

	if (readMarkerIndex === null) {
		return { visibleStart, expandedThreadRoots };
	}

	const markerItem = flattened[readMarkerIndex];
	if (markerItem?.comment.parentId === null) {
		return { visibleStart, expandedThreadRoots };
	}

	let replyCount = 0;
	for (const item of flattened) {
		if (item.threadRootId === markerItem.threadRootId && item.comment.parentId !== null) {
			replyCount += 1;
		}
	}
	if (replyCount >= THREAD_COLLAPSE_THRESHOLD) {
		expandedThreadRoots.add(markerItem.threadRootId);
	}

	return { visibleStart, expandedThreadRoots };
}

export default function CommentSection({ postId, initialComments, readMarker }: CommentSectionProps) {
	const { data: session } = useSession();
	const { showToast } = useToast();
	const [readMarkerState, setReadMarkerState] = useState(readMarker);
	const [typingUsers, setTypingUsers] = useState<string[]>([]);
	const [initialViewState] = useState<InitialCommentViewState>(() =>
		buildInitialCommentViewState(initialComments, readMarker?.lastReadCommentCount ?? 0)
	);
	const [comments, setComments] = useState<Comment[]>(initialComments);
	const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
	const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
	const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);
	const [isPinnedModalOpen, setIsPinnedModalOpen] = useState(false);
	const [visibleStart, setVisibleStart] = useState(initialViewState.visibleStart);
	const [composerReserveHeight, setComposerReserveHeight] = useState(120);
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

	const hasOlderComments = effectiveVisibleStart > 0;
	const olderLoadCount = Math.min(LATEST_CHUNK_SIZE, effectiveVisibleStart);

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
		scrollToBottom,
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

	// 작성기 높이 리저브 관측
	useEffect(() => {
		const composer = composerShellRef.current;
		if (!composer) return;
		const updateReserve = () => {
			const nextHeight = Math.ceil(composer.getBoundingClientRect().height) + 24;
			setComposerReserveHeight((prev) => (prev === nextHeight ? prev : nextHeight));
		};
		updateReserve();
		window.addEventListener("resize", updateReserve);
		if (typeof ResizeObserver === "undefined") {
			return () => window.removeEventListener("resize", updateReserve);
		}
		const observer = new ResizeObserver(updateReserve);
		observer.observe(composer);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateReserve);
		};
	}, []);

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

	const handleLoadOlderComments = () => setVisibleStart((prev) => Math.max(0, prev - LATEST_CHUNK_SIZE));

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
				<div className="comment-list" style={{ paddingBottom: `${composerReserveHeight}px` }}>
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

			<style jsx>{`
				.comment-section {
					position: relative;
					display: flex;
					flex-direction: column;
				}

				.comment-section-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 12px;
					margin-bottom: 8px;
				}

				.pinned-list-btn {
					display: inline-flex;
					align-items: center;
					gap: 6px;
				}

				.comment-stream {
					/* 통합 스크롤 영역 */
				}

					.comment-list {
						padding: 0;
					}

				.older-loader {
					display: flex;
					justify-content: center;
					margin: 6px 0 14px;
				}

				.comment-row {
					display: block;
					width: 100%;
					content-visibility: auto;
					contain-intrinsic-size: 140px;
				}

				:global(.read-marker) {
					display: flex;
					align-items: center;
					width: 100%;
					gap: 10px;
					margin: 10px 0;
				}

				:global(.date-divider) {
					display: grid;
					grid-template-columns: 1fr auto 1fr;
					align-items: center;
					justify-content: center;
					align-self: stretch;
					width: 100%;
					gap: 8px;
					margin: 16px 0 12px;
				}

				:global(.date-divider .divider-label) {
					font-size: 8px;
					font-weight: 500;
					color: var(--text-muted);
					opacity: 0.5;
					line-height: 1;
					background: transparent;
					padding: 0 4px;
					white-space: nowrap;
					flex-shrink: 0;
					text-align: center;
				}

				:global(.read-marker .divider-label) {
					font-size: 0.82rem;
					font-weight: 700;
					color: var(--warning);
					background: color-mix(in srgb, var(--warning) 14%, transparent);
					padding: 2px 10px;
					border-radius: 999px;
					border: 1px solid color-mix(in srgb, var(--warning) 42%, transparent);
				}

				:global(.date-divider .divider-line) {
					height: 1px;
					flex: 1;
					background: color-mix(in srgb, var(--border) 65%, transparent);
					opacity: 0.5;
				}
				:global(.read-marker .divider-line) {
					height: 1px;
					flex: 1;
					background: color-mix(in srgb, var(--warning) 45%, transparent);
				}

				.thread-toggle-row {
					padding-left: 48px;
					margin: 2px 0 8px;
				}

				.thread-toggle-btn {
					display: inline-flex;
					align-items: center;
					gap: 6px;
					border: 1px solid var(--border);
					background: var(--bg-secondary);
					color: var(--text-secondary);
					padding: 4px 10px;
					border-radius: 999px;
					font-size: 0.78rem;
					transition: border-color 0.15s ease, color 0.15s ease;
				}

				.thread-toggle-btn:hover {
					color: var(--text-primary);
					border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
				}

				.thread-toggle-btn :global(svg) {
					transition: transform 0.15s ease;
				}

				.thread-toggle-btn :global(svg.expanded) {
					transform: rotate(180deg);
				}

				.pinned-list {
					display: flex;
					flex-direction: column;
					gap: 8px;
				}

				.pinned-item {
					width: 100%;
					padding: 10px 12px;
					text-align: left;
					border: 1px solid var(--border);
					border-radius: 8px;
					background: var(--bg-secondary);
					transition: border-color 0.15s ease, background 0.15s ease;
				}

				.pinned-item:hover {
					border-color: color-mix(in srgb, var(--accent) 50%, var(--border));
					background: var(--bg-tertiary);
				}

				.pinned-item-meta {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: 10px;
					margin-bottom: 4px;
				}

				.pinned-item-author {
					font-size: 0.84rem;
					color: var(--text-primary);
					font-weight: 600;
				}

				.pinned-item-date {
					font-size: 0.74rem;
					color: var(--text-muted);
				}

				.pinned-item-preview {
					font-size: 0.86rem;
					color: var(--text-secondary);
					line-height: 1.45;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.composer-dock {
					position: fixed;
					left: 0;
					right: 0;
					bottom: 0;
					z-index: 56;
					display: flex;
					justify-content: center;
					padding: 0 16px 0 16px;
					pointer-events: none;
				}

				.composer-shell {
					width: 100%;
					max-width: none;
					pointer-events: auto;
					border-radius: 8px 8px 0 0;
					border: none;
					background: color-mix(in srgb, var(--color-bg-secondary) 95%, transparent);
					backdrop-filter: blur(4px);
					box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
					padding: 4px;
				}

				@media (min-width: 769px) {
					.composer-dock {
						left: var(--spacing-sidebar);
						padding-left: 32px;
						padding-right: 32px;
					}
				}

				@media (max-width: 768px) {
					.comment-stream {
						max-height: min(52vh, 620px);
					}

					.thread-toggle-row {
						padding-left: 42px;
					}

					.composer-dock {
						padding: 0 12px 16px 12px;
					}
				}
			`}</style>
		</div>
	);
}
