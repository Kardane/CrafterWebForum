"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ChevronDown, Pin } from "lucide-react";
import CommentItem from "./CommentItem";
import CommentForm from "./CommentForm";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/useToast";
import { OPEN_PINNED_COMMENTS_EVENT } from "@/constants/comments";
import {
	clearPostDetailScrollState,
	readPostDetailScrollState,
	savePostDetailScrollState,
} from "@/lib/scroll-restore";
import {
	flattenCommentsForStream,
	toReplyPreview,
	type FlattenedStreamComment,
} from "@/lib/comment-stream";
import { toSessionUserId } from "@/lib/session-user";

interface Comment {
	id: number;
	content: string;
	createdAt: string;
	updatedAt: string;
	isPinned: boolean;
	parentId: number | null;
	isPostAuthor: boolean;
	author: {
		id: number;
		nickname: string;
		minecraftUuid: string | null;
		role: string;
	};
	replies: Comment[];
}

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
	| {
			type: "read-marker";
			key: string;
	  }
	| {
			type: "comment";
			key: string;
			item: FlattenedComment;
	  }
	| {
			type: "thread-toggle";
			key: string;
			rootId: number;
			replyCount: number;
			isCollapsed: boolean;
	  };

const LATEST_CHUNK_SIZE = 40;
const THREAD_COLLAPSE_THRESHOLD = 8;
const DETAIL_SCROLL_SAVE_DELAY_MS = 240;

function appendReplyToThread(nodes: Comment[], rootId: number, newComment: Comment): Comment[] {
	return nodes.map((node) => {
		if (node.id === rootId) {
			return {
				...node,
				replies: [...node.replies, newComment],
			};
		}
		if (node.replies.length === 0) {
			return node;
		}
		return {
			...node,
			replies: appendReplyToThread(node.replies, rootId, newComment),
		};
	});
}

function updateCommentInTree(nodes: Comment[], targetId: number, content: string, updatedAt: string): Comment[] {
	return nodes.map((node) => {
		if (node.id === targetId) {
			return {
				...node,
				content,
				updatedAt,
			};
		}
		if (node.replies.length === 0) {
			return node;
		}
		return {
			...node,
			replies: updateCommentInTree(node.replies, targetId, content, updatedAt),
		};
	});
}

function removeCommentFromTree(nodes: Comment[], targetId: number): Comment[] {
	return nodes
		.filter((node) => node.id !== targetId)
		.map((node) => ({
			...node,
			replies: removeCommentFromTree(node.replies, targetId),
		}));
}

function updateCommentPinnedInTree(nodes: Comment[], targetId: number, isPinned: boolean): Comment[] {
	return nodes.map((node) => {
		if (node.id === targetId) {
			return {
				...node,
				isPinned,
			};
		}
		if (node.replies.length === 0) {
			return node;
		}
		return {
			...node,
			replies: updateCommentPinnedInTree(node.replies, targetId, isPinned),
		};
	});
}

function getReadMarkerIndex(total: number, lastReadCommentCount: number): number | null {
	if (total <= 0 || lastReadCommentCount <= 0 || lastReadCommentCount >= total) {
		return null;
	}
	return lastReadCommentCount;
}

function parseCommentIdFromElementId(rawId: string): number | null {
	const value = rawId.replace("comment-", "");
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return null;
	}
	return parsed;
}

export default function CommentSection({ postId, initialComments, readMarker }: CommentSectionProps) {
	const { data: session } = useSession();
	const { showToast } = useToast();
	const [comments, setComments] = useState<Comment[]>(initialComments);
	const [isLoading, setIsLoading] = useState(false);
	const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
	const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
	const [highlightedCommentId, setHighlightedCommentId] = useState<number | null>(null);
	const [isPinnedModalOpen, setIsPinnedModalOpen] = useState(false);
	const [visibleStart, setVisibleStart] = useState(0);
	const [composerReserveHeight, setComposerReserveHeight] = useState(120);
	const [expandedThreadRoots, setExpandedThreadRoots] = useState<Set<number>>(() => new Set());
	const [requestedEditCommentId, setRequestedEditCommentId] = useState<number | null>(null);
	const streamRef = useRef<HTMLDivElement>(null);
	const composerShellRef = useRef<HTMLDivElement>(null);
	const highlightTimerRef = useRef<number | null>(null);
	const scrollSaveTimerRef = useRef<number | null>(null);
	const hasInitializedViewRef = useRef(false);
	const restoreAppliedRef = useRef(false);

	const flattenedComments = useMemo(() => flattenCommentsForStream(comments), [comments]);
	const sessionUserId = toSessionUserId(session?.user?.id);
	const latestOwnCommentId = useMemo(() => {
		if (!sessionUserId) {
			return null;
		}
		for (let index = flattenedComments.length - 1; index >= 0; index -= 1) {
			const candidate = flattenedComments[index];
			if (candidate.comment.author.id === sessionUserId) {
				return candidate.comment.id;
			}
		}
		return null;
	}, [flattenedComments, sessionUserId]);
	const threadReplyCounts = useMemo(() => {
		const counts = new Map<number, number>();
		for (const item of flattenedComments) {
			if (item.comment.parentId === null) {
				continue;
			}
			counts.set(item.threadRootId, (counts.get(item.threadRootId) ?? 0) + 1);
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
	const hasOlderComments = visibleStart > 0;
	const olderLoadCount = Math.min(LATEST_CHUNK_SIZE, visibleStart);

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
			if (targetIndex < 0) {
				return false;
			}
			setVisibleStart((prev) => {
				if (targetIndex >= prev) {
					return prev;
				}
				return Math.max(0, targetIndex - 2);
			});
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

	const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
		requestAnimationFrame(() => {
			document.getElementById("comment-feed-end")?.scrollIntoView({ behavior, block: "end" });
		});
	};

	const scrollToCommentElement = (commentId: number, highlight: boolean, attempt = 0) => {
		const target = document.getElementById(`comment-${commentId}`);
		if (!target) {
			if (attempt < 12) {
				window.setTimeout(() => {
					scrollToCommentElement(commentId, highlight, attempt + 1);
				}, 60);
			}
			return;
		}
		target.scrollIntoView({ behavior: "smooth", block: "center" });
		if (!highlight) {
			return;
		}
		setHighlightedCommentId(commentId);
		if (highlightTimerRef.current !== null) {
			window.clearTimeout(highlightTimerRef.current);
		}
		highlightTimerRef.current = window.setTimeout(() => {
			setHighlightedCommentId((prev) => (prev === commentId ? null : prev));
		}, 1600);
	};

	const findViewportAnchorCommentId = useCallback((): number | null => {
		const container = streamRef.current;
		if (!container) {
			return null;
		}
		const candidates = container.querySelectorAll<HTMLElement>(".comment-wrapper[id^='comment-']");
		if (candidates.length === 0) {
			return null;
		}
		const viewportCenter = window.innerHeight / 2;
		let bestId: number | null = null;
		let bestDistance = Number.POSITIVE_INFINITY;
		candidates.forEach((candidate) => {
			const rect = candidate.getBoundingClientRect();
			if (rect.bottom < 0 || rect.top > window.innerHeight) {
				return;
			}
			const candidateId = parseCommentIdFromElementId(candidate.id);
			if (candidateId === null) {
				return;
			}
			const center = rect.top + rect.height / 2;
			const distance = Math.abs(center - viewportCenter);
			if (distance < bestDistance) {
				bestDistance = distance;
				bestId = candidateId;
			}
		});
		return bestId;
	}, []);

	const saveDetailScrollState = useCallback(() => {
		savePostDetailScrollState(postId, {
			anchorCommentId: findViewportAnchorCommentId(),
			scrollY: window.scrollY,
		});
	}, [findViewportAnchorCommentId, postId]);

	const renderRows = useMemo<RenderRow[]>(() => {
		const rows: RenderRow[] = [];
		for (let index = visibleStart; index < flattenedComments.length; index += 1) {
			const item = flattenedComments[index];
			const collapsed = isThreadCollapsed(item.threadRootId);
			if (collapsed && item.comment.parentId !== null) {
				continue;
			}
			if (readMarkerIndex !== null && index === readMarkerIndex) {
				rows.push({ type: "read-marker", key: `read-marker-${index}` });
			}
			rows.push({
				type: "comment",
				key: `comment-${item.comment.id}`,
				item,
			});
			if (item.comment.id !== item.threadRootId) {
				continue;
			}
			const replyCount = threadReplyCounts.get(item.threadRootId) ?? 0;
			if (replyCount < THREAD_COLLAPSE_THRESHOLD) {
				continue;
			}
			rows.push({
				type: "thread-toggle",
				key: `thread-toggle-${item.threadRootId}`,
				rootId: item.threadRootId,
				replyCount,
				isCollapsed: collapsed,
			});
		}
		return rows;
	}, [flattenedComments, isThreadCollapsed, readMarkerIndex, threadReplyCounts, visibleStart]);

	useEffect(
		() => () => {
			if (highlightTimerRef.current !== null) {
				window.clearTimeout(highlightTimerRef.current);
			}
			if (scrollSaveTimerRef.current !== null) {
				window.clearTimeout(scrollSaveTimerRef.current);
			}
		},
		[]
	);

	useEffect(() => {
		const openPinnedModal = () => {
			setIsPinnedModalOpen(true);
		};
		window.addEventListener(OPEN_PINNED_COMMENTS_EVENT, openPinnedModal);
		return () => {
			window.removeEventListener(OPEN_PINNED_COMMENTS_EVENT, openPinnedModal);
		};
	}, []);

	useEffect(() => {
		const composer = composerShellRef.current;
		if (!composer) {
			return;
		}

		const updateReserve = () => {
			const nextHeight = Math.ceil(composer.getBoundingClientRect().height) + 24;
			setComposerReserveHeight((prev) => (prev === nextHeight ? prev : nextHeight));
		};

		updateReserve();
		window.addEventListener("resize", updateReserve);

		if (typeof ResizeObserver === "undefined") {
			return () => {
				window.removeEventListener("resize", updateReserve);
			};
		}

		const observer = new ResizeObserver(updateReserve);
		observer.observe(composer);

		return () => {
			observer.disconnect();
			window.removeEventListener("resize", updateReserve);
		};
	}, []);

	useEffect(() => {
		const total = flattenedComments.length;
		if (total === 0) {
			setVisibleStart(0);
			return;
		}
		if (!hasInitializedViewRef.current) {
			const defaultStart = Math.max(0, total - LATEST_CHUNK_SIZE);
			let nextStart = defaultStart;
			if (readMarkerIndex !== null && readMarkerIndex < nextStart) {
				nextStart = readMarkerIndex;
			}
			setVisibleStart(nextStart);
			if (readMarkerIndex !== null) {
				const markerItem = flattenedComments[readMarkerIndex];
				if (markerItem?.comment.parentId !== null && isThreadCollapsible(markerItem.threadRootId)) {
					setExpandedThreadRoots((prev) => {
						const next = new Set(prev);
						next.add(markerItem.threadRootId);
						return next;
					});
				}
			}
			hasInitializedViewRef.current = true;
			return;
		}
		setVisibleStart((prev) => {
			const maxStart = Math.max(0, total - 1);
			return prev > maxStart ? maxStart : prev;
		});
	}, [flattenedComments, isThreadCollapsible, readMarkerIndex]);

	useEffect(() => {
		if (restoreAppliedRef.current || flattenedComments.length === 0) {
			return;
		}
		const saved = readPostDetailScrollState(postId);
		if (!saved) {
			return;
		}
		restoreAppliedRef.current = true;
		const restore = () => {
			if (saved.anchorCommentId !== null && ensureCommentVisible(saved.anchorCommentId)) {
				requestAnimationFrame(() => {
					scrollToCommentElement(saved.anchorCommentId!, false);
				});
			} else {
				window.scrollTo({ top: saved.scrollY, behavior: "auto" });
			}
			clearPostDetailScrollState(postId);
		};
		restore();
	}, [ensureCommentVisible, flattenedComments, postId]);

	useEffect(() => {
		const handleScroll = () => {
			if (scrollSaveTimerRef.current !== null) {
				window.clearTimeout(scrollSaveTimerRef.current);
			}
			scrollSaveTimerRef.current = window.setTimeout(() => {
				saveDetailScrollState();
			}, DETAIL_SCROLL_SAVE_DELAY_MS);
		};
		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				saveDetailScrollState();
			}
		};
		window.addEventListener("scroll", handleScroll, { passive: true });
		window.addEventListener("beforeunload", saveDetailScrollState);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			if (scrollSaveTimerRef.current !== null) {
				window.clearTimeout(scrollSaveTimerRef.current);
			}
			saveDetailScrollState();
			window.removeEventListener("scroll", handleScroll);
			window.removeEventListener("beforeunload", saveDetailScrollState);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [saveDetailScrollState]);

	const handleCommentCreate = async (content: string, parentId: number | null = null) => {
		if (!session?.user) {
			showToast({ type: "error", message: "로그인이 필요함" });
			throw new Error("unauthenticated");
		}
		setIsLoading(true);
		try {
			const response = await fetch(`/api/posts/${postId}/comments`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ content, parentId }),
			});
			const data = (await response.json()) as { error?: string; comment: Comment };
			if (!response.ok) {
				throw new Error(data.error || "Failed to create comment");
			}
			if (parentId === null) {
				setComments((prev) => [...prev, data.comment]);
			} else {
				setComments((prev) => appendReplyToThread(prev, parentId, data.comment));
				setReplyTarget(null);
				setExpandedThreadRoots((prev) => {
					const next = new Set(prev);
					next.add(parentId);
					return next;
				});
			}
			scrollToBottom("smooth");
		} catch (error) {
			console.error("Comment create error:", error);
			showToast({ type: "error", message: "댓글 작성 실패" });
			throw error;
		} finally {
			setIsLoading(false);
		}
	};

	const handleCommentUpdate = async (commentId: number, content: string) => {
		setIsLoading(true);
		try {
			const response = await fetch(`/api/comments/${commentId}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ content }),
			});
			const data = await response.json();
			if (!response.ok) {
				throw new Error(data.error || "Failed to update comment");
			}
			setComments((prev) => updateCommentInTree(prev, commentId, data.comment.content, data.comment.updatedAt));
			showToast({ type: "success", message: "댓글 수정 완료" });
		} catch (error) {
			console.error("Comment update error:", error);
			showToast({ type: "error", message: "댓글 수정 실패" });
			throw error;
		} finally {
			setIsLoading(false);
		}
	};

	const handleCommentDeleteConfirmed = async (commentId?: number) => {
		const idToDelete = commentId ?? pendingDeleteId;
		if (idToDelete === null) {
			return;
		}
		setIsLoading(true);
		try {
			const response = await fetch(`/api/comments/${idToDelete}`, {
				method: "DELETE",
			});
			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.error || "Failed to delete comment");
			}
			setComments((prev) => removeCommentFromTree(prev, idToDelete));
			setPendingDeleteId(null);
			showToast({ type: "success", message: "댓글 삭제 완료" });
		} catch (error) {
			console.error("Comment delete error:", error);
			showToast({ type: "error", message: "댓글 삭제 실패" });
		} finally {
			setIsLoading(false);
		}
	};

	const handleReplyRequest = (commentId: number, nickname: string) => {
		setReplyTarget({ parentId: commentId, nickname });
		requestAnimationFrame(() => {
			const input = document.getElementById("comment-composer-input");
			if (input instanceof HTMLTextAreaElement) {
				input.focus();
			}
		});
	};

	const handleNavigateToComment = (commentId: number) => {
		if (!ensureCommentVisible(commentId)) {
			showToast({ type: "error", message: "원본 댓글을 찾을 수 없음" });
			return;
		}
		const { pathname, search } = window.location;
		window.history.replaceState(null, "", `${pathname}${search}#comment-${commentId}`);
		requestAnimationFrame(() => {
			scrollToCommentElement(commentId, true);
		});
	};

	const handleCommentPinToggle = async (commentId: number) => {
		setIsLoading(true);
		try {
			const response = await fetch(`/api/comments/${commentId}/pin`, {
				method: "POST",
			});
			const data = (await response.json()) as {
				error?: string;
				comment?: { id: number; isPinned: boolean };
			};
			if (!response.ok || !data.comment) {
				throw new Error(data.error || "Failed to toggle comment pin");
			}
			setComments((prev) => updateCommentPinnedInTree(prev, commentId, data.comment!.isPinned));
			showToast({
				type: "success",
				message: data.comment.isPinned ? "댓글 고정 완료" : "댓글 고정 해제 완료",
			});
		} catch (error) {
			console.error("Comment pin toggle error:", error);
			showToast({ type: "error", message: "댓글 고정 처리 실패" });
		} finally {
			setIsLoading(false);
		}
	};

	const handlePinnedCommentSelect = (commentId: number) => {
		setIsPinnedModalOpen(false);
		requestAnimationFrame(() => {
			handleNavigateToComment(commentId);
		});
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
		requestAnimationFrame(() => {
			scrollToCommentElement(latestOwnCommentId, true);
		});
	};

	const handleLoadOlderComments = () => {
		setVisibleStart((prev) => Math.max(0, prev - LATEST_CHUNK_SIZE));
	};

	const handleToggleThread = (rootId: number) => {
		setExpandedThreadRoots((prev) => {
			const next = new Set(prev);
			if (next.has(rootId)) {
				next.delete(rootId);
			} else {
				next.add(rootId);
			}
			return next;
		});
	};

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
					고정 댓글
					{pinnedComments.length > 0 ? ` ${pinnedComments.length}` : ""}
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
								return (
									<div key={row.key} className="read-marker">
										<span>여기부터 새 댓글</span>
									</div>
								);
							}
							if (row.type === "thread-toggle") {
								return (
									<div key={row.key} className="thread-toggle-row">
										<button
											type="button"
											className="thread-toggle-btn"
											onClick={() => handleToggleThread(row.rootId)}
										>
											<ChevronDown size={14} className={row.isCollapsed ? "" : "expanded"} />
											{row.isCollapsed
												? `답글 ${row.replyCount}개 펼치기`
												: `답글 ${row.replyCount}개 접기`}
										</button>
									</div>
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
									onEditRequestConsumed={(commentId) => {
										setRequestedEditCommentId((prev) => (prev === commentId ? null : prev));
									}}
									onNavigateToComment={handleNavigateToComment}
									onReplyRequest={handleReplyRequest}
									onEdit={handleCommentUpdate}
									onPin={handleCommentPinToggle}
									onDelete={(commentId, event) => {
										if (event?.shiftKey) {
											void handleCommentDeleteConfirmed(commentId);
										} else {
											setPendingDeleteId(commentId);
										}
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

			<Modal
				isOpen={isPinnedModalOpen}
				onClose={() => setIsPinnedModalOpen(false)}
				title="고정 댓글"
				size="md"
				variant="sidebarLike"
			>
				{pinnedComments.length === 0 ? (
					<p className="text-sm text-text-secondary">고정된 댓글 없음</p>
				) : (
					<ul className="pinned-list">
						{pinnedComments.map((item) => (
							<li key={item.id}>
								<button
									type="button"
									className="pinned-item"
									onClick={() => {
										handlePinnedCommentSelect(item.id);
									}}
								>
									<div className="pinned-item-meta">
										<span className="pinned-item-author">@{item.authorNickname}</span>
										<span className="pinned-item-date">
											{new Date(item.createdAt).toLocaleString("ko-KR", {
												month: "2-digit",
												day: "2-digit",
												hour: "2-digit",
												minute: "2-digit",
											})}
										</span>
									</div>
									<p className="pinned-item-preview">{item.preview}</p>
								</button>
							</li>
						))}
					</ul>
				)}
			</Modal>

			<Modal
				isOpen={pendingDeleteId !== null}
				onClose={() => setPendingDeleteId(null)}
				title="댓글 삭제"
				size="sm"
				variant="sidebarLike"
				footer={
					<div className="flex justify-end gap-2">
						<button type="button" className="btn btn-secondary btn-sm" onClick={() => setPendingDeleteId(null)}>
							취소
						</button>
						<button
							type="button"
							className="btn btn-danger btn-sm"
							onClick={() => {
								void handleCommentDeleteConfirmed();
							}}
						>
							삭제
						</button>
					</div>
				}
			>
				<p className="text-sm text-text-secondary">선택한 댓글을 삭제할까</p>
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
