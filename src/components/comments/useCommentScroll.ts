"use client";

/**
 * 댓글 스크롤 관리 커스텀 훅
 * 뷰포트 앵커 탐색, 스크롤 상태 저장/복원, 하이라이트 등
 */

import { type RefObject, useCallback, useEffect, useRef } from "react";
import {
	clearPostDetailScrollState,
	readPostDetailScrollState,
	savePostDetailScrollState,
} from "@/lib/scroll-restore";
import { DETAIL_SCROLL_SAVE_DELAY_MS, parseCommentIdFromElementId } from "@/lib/comment-tree-ops";

interface UseCommentScrollOptions {
	postId: number;
	streamRef: RefObject<HTMLDivElement | null>;
	ensureCommentVisible: (commentId: number) => boolean;
	flattenedCommentsLength: number;
}

export function useCommentScroll({
	postId,
	streamRef,
	ensureCommentVisible,
	flattenedCommentsLength,
}: UseCommentScrollOptions) {
	const highlightTimerRef = useRef<number | null>(null);
	const scrollSaveTimerRef = useRef<number | null>(null);
	const restoreAppliedRef = useRef(false);
	const restoreCheckedRef = useRef(false);
	const latestJumpAppliedRef = useRef(false);

	// 댓글 피드 최하단으로 스크롤
	const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
		requestAnimationFrame(() => {
			document.getElementById("comment-feed-end")?.scrollIntoView({ behavior, block: "end" });
		});
	}, []);

	// 특정 댓글 요소로 스크롤 (재시도 포함)
	const scrollToCommentElement = useCallback(
		(commentId: number, highlight: boolean, setHighlightedCommentId: (id: number | null) => void) => {
			const tryScroll = (attempt: number) => {
				const target = document.getElementById(`comment-${commentId}`);
				if (!target) {
					if (attempt < 12) {
						window.setTimeout(() => {
							tryScroll(attempt + 1);
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
					setHighlightedCommentId(null);
				}, 1600);
			};

			tryScroll(0);
		},
		[]
	);

	// 뷰포트 중앙에 가장 가까운 댓글 ID 탐색
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
	}, [streamRef]);

	// 현재 스크롤 상태 저장
	const saveDetailScrollState = useCallback(() => {
		savePostDetailScrollState(postId, {
			anchorCommentId: findViewportAnchorCommentId(),
			scrollY: window.scrollY,
		});
	}, [findViewportAnchorCommentId, postId]);

	// 타이머 클린업
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

	// postId 변경 시 복원 플래그 리셋
	useEffect(() => {
		restoreAppliedRef.current = false;
		restoreCheckedRef.current = false;
		latestJumpAppliedRef.current = false;
	}, [postId]);

	// 저장된 스크롤 위치 복원
	useEffect(() => {
		if (restoreCheckedRef.current || flattenedCommentsLength === 0) {
			return;
		}
		restoreCheckedRef.current = true;
		const saved = readPostDetailScrollState(postId);
		if (!saved) {
			return;
		}
		restoreAppliedRef.current = true;
		if (saved.anchorCommentId !== null && ensureCommentVisible(saved.anchorCommentId)) {
			requestAnimationFrame(() => {
				const target = document.getElementById(`comment-${saved.anchorCommentId}`);
				target?.scrollIntoView({ behavior: "smooth", block: "center" });
			});
		} else {
			window.scrollTo({ top: saved.scrollY, behavior: "auto" });
		}
		clearPostDetailScrollState(postId);
	}, [ensureCommentVisible, flattenedCommentsLength, postId]);

	// 첫 진입 시 최신 댓글로 이동
	useEffect(() => {
		if (latestJumpAppliedRef.current || flattenedCommentsLength === 0) {
			return;
		}
		if (!restoreCheckedRef.current || restoreAppliedRef.current) {
			return;
		}
		latestJumpAppliedRef.current = true;
		requestAnimationFrame(() => {
			document.getElementById("comment-feed-end")?.scrollIntoView({
				behavior: "auto",
				block: "end",
			});
		});
	}, [flattenedCommentsLength]);

	// 스크롤/비저빌리티 이벤트 리스너 등록
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

	return {
		scrollToBottom,
		scrollToCommentElement,
	};
}
