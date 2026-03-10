"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/useToast";

const TOAST_MESSAGES: Record<string, string> = {
	"approval-required": "개발 포럼을 이용하려면 관리자 승인을 받아야 함",
};

export default function LandingToastHandler() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const { showToast } = useToast();

	useEffect(() => {
		const toastKey = searchParams.get("toast");
		if (!toastKey) {
			return;
		}

		const message = TOAST_MESSAGES[toastKey];
		if (!message) {
			return;
		}

		showToast({ type: "error", message });

		const nextParams = new URLSearchParams(searchParams.toString());
		nextParams.delete("toast");
		const nextQuery = nextParams.toString();
		router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
	}, [pathname, router, searchParams, showToast]);

	return null;
}
