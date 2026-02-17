"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * 페이지 이동 중 마우스 커서를 wait(모래시계)로 바꿔주는 컴포넌트
 */
export default function LoadingCursor() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, setIsPending] = useState(false);

	useEffect(() => {
		// 경로가 변경되면 로딩 상태 해제
		setIsPending(false);
	}, [pathname, searchParams]);

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
				setIsPending(true);
			}
		};

		document.addEventListener("click", handleAnchorClick);
		return () => document.removeEventListener("click", handleAnchorClick);
	}, []);

	useEffect(() => {
		if (isPending) {
			document.body.style.cursor = "wait";
			// 만약 너무 오래 걸리면(예: 10초) 수동으로 풀리도록 타임아웃
			const timeout = setTimeout(() => setIsPending(false), 10000);
			return () => {
				clearTimeout(timeout);
				document.body.style.cursor = "default";
			};
		} else {
			document.body.style.cursor = "default";
		}
	}, [isPending]);

	return null;
}
