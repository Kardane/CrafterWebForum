"use client";

import { signOut } from "next-auth/react";

interface LandingHeaderAuthActionsProps {
	nickname: string;
	greetingPrefix: string;
}

export default function LandingHeaderAuthActions({
	nickname,
	greetingPrefix,
}: LandingHeaderAuthActionsProps) {
	return (
		<div className="flex flex-wrap items-center gap-2">
			<div className="rounded-full border border-white/15 bg-black/25 px-4 py-2 text-sm font-semibold text-white/90 shadow-[0_10px_30px_rgba(0,0,0,0.25)]">
				{greetingPrefix} {nickname}님!
			</div>
			<button
				type="button"
				onClick={() => signOut({ callbackUrl: "/" })}
				className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm text-white/85 transition-colors hover:bg-white/10"
			>
				로그아웃
			</button>
		</div>
	);
}
