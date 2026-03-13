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
		setIsActionSuppressed(false);
		setIsToolbarActive(false);
	}, [clearSuppressionTimer, isEditing]);

	const activateToolbar = useCallback(() => {
		if (isEditing) {
			return;
		}
		setIsToolbarActive(true);
	}, [isEditing]);

	const scheduleToolbarHide = useCallback(() => {
		if (isEditing) {
			return;
		}
		setIsToolbarActive(false);
	}, [isEditing]);

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
