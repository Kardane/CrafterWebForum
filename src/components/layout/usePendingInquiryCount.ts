"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const INQUIRY_COUNT_CACHE_TTL_MS = 30_000;

let inquiryCountCache: { value: number; expiresAt: number } | null = null;

export function usePendingInquiryCount(canAccessAdmin: boolean) {
	const [inquiryCount, setInquiryCount] = useState(0);
	const loadCountRef = useRef<(force?: boolean) => Promise<void>>(async () => {});

	useEffect(() => {
		let isDisposed = false;
		let controller = new AbortController();

		loadCountRef.current = async (force = false) => {
			if (!canAccessAdmin) {
				setInquiryCount(0);
				return;
			}

			if (!force && inquiryCountCache && inquiryCountCache.expiresAt > Date.now()) {
				setInquiryCount(inquiryCountCache.value);
				return;
			}

			controller.abort();
			controller = new AbortController();

			try {
				const res = await fetch("/api/inquiries/pending-count", {
					cache: "no-store",
					signal: controller.signal,
				});

				if (isDisposed) {
					return;
				}

				if (res.status === 401 || res.status === 403) {
					setInquiryCount(0);
					return;
				}

				if (!res.ok) {
					setInquiryCount(0);
					return;
				}

				const data = (await res.json()) as { count?: number };
				const count = Number(data.count ?? 0);
				inquiryCountCache = {
					value: count,
					expiresAt: Date.now() + INQUIRY_COUNT_CACHE_TTL_MS,
				};
				setInquiryCount(count);
			} catch (error) {
				const abortError = error as { name?: string };
				if (abortError.name === "AbortError") {
					return;
				}
				if (!isDisposed) {
					setInquiryCount(0);
				}
			}
		};

		void loadCountRef.current();

		const handleVisibility = () => {
			if (document.visibilityState !== "visible") {
				return;
			}
			void loadCountRef.current();
		};

		document.addEventListener("visibilitychange", handleVisibility);
		return () => {
			isDisposed = true;
			controller.abort();
			document.removeEventListener("visibilitychange", handleVisibility);
		};
	}, [canAccessAdmin]);

	const refreshInquiryCount = useCallback(async () => {
		await loadCountRef.current(true);
	}, []);

	return {
		inquiryCount,
		refreshInquiryCount,
	};
}
