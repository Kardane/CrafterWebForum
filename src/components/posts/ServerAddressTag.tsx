"use client";

import classNames from "classnames";
import { useToast } from "@/components/ui/useToast";
import { Copy } from "lucide-react";

interface ServerAddressTagProps {
	address: string;
	className?: string;
}

export default function ServerAddressTag({ address, className }: ServerAddressTagProps) {
	const { showToast } = useToast();

	const copyToClipboard = async () => {
		if (!address.trim()) {
			return;
		}

		if (!navigator.clipboard?.writeText) {
			showToast({ type: "error", message: "클립보드 복사를 지원하지 않는 환경" });
			return;
		}

		try {
			await navigator.clipboard.writeText(address);
			showToast({ type: "success", message: "서버 주소 복사됨" });
		} catch {
			showToast({ type: "error", message: "클립보드 복사 실패" });
		}
	};

	const handleClick = (event: React.MouseEvent<HTMLSpanElement>) => {
		event.preventDefault();
		event.stopPropagation();
		void copyToClipboard();
	};

	const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			event.stopPropagation();
			void copyToClipboard();
		}
	};

	return (
		<span
			role="button"
			tabIndex={0}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			className={classNames(
				"group inline-flex items-center gap-1.5 px-2 py-[2px] rounded text-[10px] font-medium bg-bg-tertiary text-text-secondary hover:bg-bg-primary/40 transition-colors cursor-pointer select-none",
				className
			)}
			title="클릭해서 복사"
			aria-label={`서버 주소 복사: ${address}`}
		>
			<span className="truncate">{address}</span>
			<Copy size={12} className="opacity-70 group-hover:opacity-100" aria-hidden="true" />
		</span>
	);
}
