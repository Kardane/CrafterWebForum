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
import ReadMarkerRow from "./ReadMarkerRow";
import ThreadToggleRow from "./ThreadToggleRow";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { OPEN_PINNED_COMMENTS_EVENT } from "@/constants/comments";
import {
	flattenCommentsForStream,
	toReplyPreview,
	type FlattenedStreamComment,
} from "@/lib/comment-stream";
import { toSessionUserId } from "@/lib/session-user";
import { text } from "@/lib/system-text";
import {
	type Comment,
	LATEST_CHUNK_SIZE,
	THREAD_COLLAPSE_THRESHOLD,
	getReadMarkerIndex,
} from "@/lib/comment-tree-ops";
import { useCommentMutations } from "./useCommentMutations";
import { useCommentScroll } from "./useCommentScroll";

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
}

type FlattenedComment = FlattenedStreamComment<Comment>;

interface PinnedCommentItem {
	id: number;
	authorNickname: string;
	createdAt: string;
	preview: string;
}

type RenderRow =
	| { type: "read-marker"; key: string }
	| { type: "comment"; key: string; item: FlattenedComment }
	| { type: "thread-toggle"; key: string; rootId: number; replyCount: number; isCollapsed: boolean };

interface InitialCommentViewState {
	visibleStart: number;
	expandedThreadRoots: Set<number>;
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
	const streamRef = useRef<HTMLDivElement>(null);
	const composerShellRef = useRef<HTMLDivElement>(null);

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
		() => getReadMarkerIndex(flattenedComments.length, readMarker?.lastReadCommentCount ?? 0),
		[flattenedComments.length, readMarker?.lastReadCommentCount]
	);

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
		for (let i = effectiveVisibleStart; i < flattenedComments.length; i += 1) {
			const item = flattenedComments[i];
			if (isThreadCollapsed(item.threadRootId) && item.comment.parentId !== null) continue;
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
		window.addEventListener(OPEN_PINNED_COMMENTS_EVENT, openPinnedModal);
		return () => window.removeEventListener(OPEN_PINNED_COMMENTS_EVENT, openPinnedModal);
	}, []);

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

	// --- 핸들러 ---
	const handleReplyRequest = (commentId: number, nickname: string) => {
		setReplyTarget({ parentId: commentId, nickname });
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
			<div className="comment-section-header">
				<h2 className="text-xl font-bold">댓글 {flattenedComments.length}개</h2>
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
							if (row.type === "read-marker") {
								return <ReadMarkerRow key={row.key} rowKey={row.key} />;
							}
							if (row.type === "thread-toggle") {
								return (
									<ThreadToggleRow
										key={row.key}
										rowKey={row.key}
										rootId={row.rootId}
										replyCount={row.replyCount}
										isCollapsed={row.isCollapsed}
										onToggle={handleToggleThread}
									/>
								);
							}
							return (
								<CommentItem
									key={row.key}
									comment={row.item.comment}
									replyToName={row.item.replyToName}
									replyToCommentId={row.item.replyToCommentId}
									replyToPreview={row.item.replyToPreview}
									threadRootId={row.item.threadRootId}
									isCompact={row.item.isCompact}
									isHighlighted={highlightedCommentId === row.item.comment.id}
									shouldStartEdit={requestedEditCommentId === row.item.comment.id}
									onEditRequestConsumed={(cId) => setRequestedEditCommentId((prev) => (prev === cId ? null : prev))}
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
							);
						})
					)}
					<div id="comment-feed-end" />
				</div>
			</div>

			<div className="composer-dock">
				<div className="composer-shell" id="comment-composer" ref={composerShellRef}>
					<CommentForm
						onSubmit={(content) => handleCommentCreate(content, replyTarget?.parentId ?? null)}
						onRequestEditLatestOwnComment={handleRequestEditLatestOwnComment}
						disabled={isLoading}
						variant="composer"
						replyTo={replyTarget?.nickname}
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

				.read-marker {
					display: flex;
					align-items: center;
					gap: 10px;
					margin: 10px 0;
					color: var(--warning);
					font-size: 0.82rem;
					font-weight: 700;
				}

				.read-marker::before,
				.read-marker::after {
					content: "";
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
					max-width: 56rem;
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
