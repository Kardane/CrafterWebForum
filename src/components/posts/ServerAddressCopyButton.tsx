"use client";

import { useToast } from "@/components/ui/useToast";

interface ServerAddressCopyButtonProps {
	serverAddress: string;
}

export default function ServerAddressCopyButton({ serverAddress }: ServerAddressCopyButtonProps) {
	const { showToast } = useToast();

	const handleClick = async () => {
		try {
			await navigator.clipboard?.writeText(serverAddress);
			showToast({ type: "success", message: "서버 주소 복사 완료" });
		} catch {
			showToast({ type: "error", message: "서버 주소 복사 실패" });
		}
	};

	return (
		<button
			type="button"
			onClick={() => {
				void handleClick();
			}}
			className="inline-flex items-center rounded border border-border bg-bg-tertiary px-3 py-1 text-xs font-semibold text-text-secondary hover:bg-bg-primary hover:text-text-primary"
			aria-label="서버 주소 복사"
		>
			서버 주소 복사: {serverAddress}
		</button>
	);
}
