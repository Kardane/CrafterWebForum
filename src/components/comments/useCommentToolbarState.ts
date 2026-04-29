"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const TOOLBAR_SUPPRESSION_DELAY_MS = 700;

interface UseCommentToolbarStateInput {
	commentId: number;
	isEditing: boolean;
}

export function useCommentToolbarState({ commentId, isEditing }: UseCommentToolbarStateInput) {
	const [isActionSuppressed, setIsActionSuppressed] = useState(false);
	const [isToolbarActive, setIsToolbarActive] = useState(false);
	const suppressTimeoutRef = useRef<number | null>(null);

	const clearSuppressionTimer = useCallback(() => {
		if (suppressTimeoutRef.current !== null) {
			window.clearTimeout(suppressTimeoutRef.current);
			suppressTimeoutRef.current = null;
		}
	}, []);

	useEffect(
		() => () => {
			clearSuppressionTimer();
		},
		[clearSuppressionTimer]
	);

	useEffect(() => {
		if (!isEditing) {
			return;
		}
		clearSuppressionTimer();
		const resetTimer = window.setTimeout(() => {
			setIsActionSuppressed(false);
			setIsToolbarActive(false);
		}, 0);
		return () => {
			window.clearTimeout(resetTimer);
		};
	}, [clearSuppressionTimer, isEditing]);

	const activateToolbar = useCallback(() => {
		if (isEditing) {
			return;
		}
		setIsToolbarActive(true);
	}, [isEditing]);

	const shouldKeepToolbarActive = useCallback(
		(nextTarget: EventTarget | null) => {
			if (!(nextTarget instanceof Node)) {
				return false;
			}
			const container = document.getElementById(`comment-${commentId}`);
			return Boolean(container?.contains(nextTarget));
		},
		[commentId]
	);

	const scheduleToolbarHide = useCallback((nextTarget?: EventTarget | null) => {
		if (isEditing) {
			return;
		}
		if (shouldKeepToolbarActive(nextTarget ?? null)) {
			return;
		}
		setIsToolbarActive(false);
	}, [isEditing, shouldKeepToolbarActive]);

	const resetActionSuppression = useCallback(() => {
		clearSuppressionTimer();
		setIsActionSuppressed(false);
	}, [clearSuppressionTimer]);

	const dismissToolbarFocus = useCallback(() => {
		setIsActionSuppressed(true);
		const active = document.activeElement;
		if (active instanceof HTMLElement && active.closest(`#comment-${commentId}`)) {
			active.blur();
		}
		const selection = window.getSelection();
		if (selection && selection.rangeCount > 0) {
			selection.removeAllRanges();
		}
		clearSuppressionTimer();
		suppressTimeoutRef.current = window.setTimeout(() => {
			setIsActionSuppressed(false);
		}, TOOLBAR_SUPPRESSION_DELAY_MS);
	}, [clearSuppressionTimer, commentId]);

	return {
		isActionSuppressed,
		isToolbarActive,
		activateToolbar,
		scheduleToolbarHide,
		resetActionSuppression,
		dismissToolbarFocus,
	};
}
