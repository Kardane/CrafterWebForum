"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUp, MessageCircle } from "lucide-react";
import LikeButton from "./LikeButton";

interface PostStickyHeaderProps {
	postId: number;
	title: string;
	authorName: string;
	createdAt: string | Date;
	commentCount: number;
	initialLikes: number;
	initialLiked: boolean;
	triggerId?: string;
	topOffsetClassName?: string;
	observerOffsetTop?: number;
}

function formatPostDate(dateValue: string | Date): string {
	return new Date(dateValue).toLocaleString("ko-KR", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

export default function PostStickyHeader({
	postId,
	title,
	authorName,
	createdAt,
	commentCount,
	initialLikes,
	initialLiked,
	triggerId = "post-header-trigger",
	topOffsetClassName = "top-header",
	observerOffsetTop = 56,
}: PostStickyHeaderProps) {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		const trigger = document.getElementById(triggerId);
		if (!trigger) {
			const onScroll = () => setIsVisible(window.scrollY > 220);
			onScroll();
			window.addEventListener("scroll", onScroll, { passive: true });
			return () => window.removeEventListener("scroll", onScroll);
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				setIsVisible(!entry.isIntersecting);
			},
			{
				rootMargin: `-${observerOffsetTop}px 0px 0px 0px`,
				threshold: 0,
			}
		);
		observer.observe(trigger);
		return () => observer.disconnect();
	}, [triggerId, observerOffsetTop]);

	return (
		<div
			className={`sticky ${topOffsetClassName} z-40 mb-3 transition-all duration-200 ${
				isVisible
					? "opacity-100 translate-y-0"
					: "opacity-0 -translate-y-2 pointer-events-none"
			}`}
		>
			<div className="rounded-md border border-border bg-bg-secondary/95 px-3 py-2 shadow-[0_6px_20px_rgba(0,0,0,0.25)] backdrop-blur">
				<div className="flex items-center gap-3">
					<Link href="/" className="btn btn-secondary btn-sm">
						<ArrowLeft size={14} />
						목록
					</Link>

					<div className="min-w-0 flex-1">
						<div className="truncate text-sm font-semibold text-text-primary">{title}</div>
						<div className="truncate text-xs text-text-muted">
							{authorName} · {formatPostDate(createdAt)}
						</div>
					</div>

					<LikeButton
						postId={postId}
						initialLikes={initialLikes}
						initialLiked={initialLiked}
						variant="legacy"
						className="!px-2.5 !py-1 !text-xs"
					/>

					<div className="flex items-center gap-1 text-xs text-text-secondary">
						<MessageCircle size={14} />
						<span>{commentCount}</span>
					</div>

					<button
						type="button"
						className="btn btn-secondary btn-sm"
						onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
						title="맨 위로"
					>
						<ArrowUp size={14} />
						맨 위
					</button>
				</div>
			</div>
		</div>
	);
}
