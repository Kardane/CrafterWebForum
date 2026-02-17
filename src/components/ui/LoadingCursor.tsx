"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * 페이지 이동 중 마우스 커서를 wait(모래시계)로 바꿔주는 컴포넌트
 */
export default function LoadingCursor() {
	const pathname = usePathname();
	const timeoutRef = useRef<number | null>(null);

	const clearPendingCursor = useCallback(() => {
		if (timeoutRef.current !== null) {
			window.clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
		document.body.style.cursor = "default";
	}, []);

	useEffect(() => {
		// 경로 변경 시 로딩 커서 강제 해제
		clearPendingCursor();
	}, [clearPendingCursor, pathname]);

	useEffect(() => {
		const handleAnchorClick = (e: MouseEvent) => {
			const target = (e.target as HTMLElement).closest("a");
			if (
				!target ||
				target.target === "_blank" ||
				e.ctrlKey ||
				e.metaKey ||
				e.shiftKey ||
				target.href.startsWith("mailto:") ||
				target.href.startsWith("tel:") ||
				target.href.includes("#") && target.href.split("#")[0] === window.location.href.split("#")[0]
			) {
				return;
			}

			// 같은 도메인일 때만 로딩 표시
			const url = new URL(target.href);
			if (url.origin === window.location.origin) {
				document.body.style.cursor = "wait";
				if (timeoutRef.current !== null) {
					window.clearTimeout(timeoutRef.current);
				}
				// 라우팅 이벤트가 유실되더라도 커서가 고정되지 않도록 안전 타임아웃 적용
				timeoutRef.current = window.setTimeout(() => {
					timeoutRef.current = null;
					document.body.style.cursor = "default";
				}, 10_000);
			}
		};

		document.addEventListener("click", handleAnchorClick);
		return () => {
			document.removeEventListener("click", handleAnchorClick);
			clearPendingCursor();
		};
	}, [clearPendingCursor]);

	return null;
}
