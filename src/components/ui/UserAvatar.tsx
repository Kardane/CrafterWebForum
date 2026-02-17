"use client";

import { useState } from "react";
import Image from "next/image";
import classNames from "classnames";

interface UserAvatarProps {
	nickname: string;
	uuid?: string | null;
	size?: number;
	className?: string;
}

export default function UserAvatar({ nickname, uuid, size = 32, className }: UserAvatarProps) {
	const [errorStage, setErrorStage] = useState(0); // 0: primary, 1: secondary, 2: initials

	if (!uuid) {
		return <InitialsAvatar nickname={nickname} size={size} className={className} />;
	}

	const handleImageError = () => {
		setErrorStage((prev) => prev + 1);
	};

	if (errorStage >= 2) {
		return <InitialsAvatar nickname={nickname} size={size} className={className} />;
	}

	// 1. Primary: Mineatar (3D Head)
	// 2. Secondary: MC-Heads (2D Face - more reliable CDN)
	const src =
		errorStage === 0
			? `https://api.mineatar.io/face/${uuid}?scale=${Math.ceil(size / 8)}`
			: `https://mc-heads.net/avatar/${uuid}/${size}`;

	return (
		<div
			className={classNames(
				"relative shrink-0 overflow-hidden rounded-md border border-border bg-bg-secondary",
				className
			)}
			style={{ width: size, height: size }}
		>
			<Image
				src={src}
				alt={nickname}
				width={size}
				height={size}
				className="h-full w-full object-cover"
				onError={handleImageError}
				unoptimized // Remote external images often work better unoptimized if domain not allowed
			/>
		</div>
	);
}

function InitialsAvatar({ nickname, size, className }: { nickname: string; size: number; className?: string }) {
	return (
		<div
			className={classNames(
				"flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-bg-secondary text-xs font-semibold text-text-muted",
				className
			)}
			style={{ width: size, height: size }}
		>
			{nickname.charAt(0).toUpperCase()}
		</div>
	);
}
