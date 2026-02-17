"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, MessageCircle, Pin } from "lucide-react";
import LikeButton from "./LikeButton";
import { OPEN_PINNED_COMMENTS_EVENT, SCROLL_COMMENT_FEED_BOTTOM_EVENT } from "@/constants/comments";

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
	void triggerId;
	void topOffsetClassName;
	void observerOffsetTop;

	return (
		<div className="sticky top-0 z-[45] transition-opacity duration-200 opacity-100">
			<div className="rounded-b-lg border-x border-b border-border bg-bg-secondary/95 px-3 py-2 shadow-sm backdrop-blur">
				<div className="flex items-center gap-3">
					<Link href="/" className="btn btn-secondary btn-sm" title="목록" aria-label="목록으로 이동">
						<ArrowLeft size={14} />
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
						onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PINNED_COMMENTS_EVENT))}
						title="고정 댓글 보기"
						aria-label="고정 댓글 보기"
					>
						<Pin size={14} />
					</button>

						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
							title="맨 위로"
							aria-label="맨 위로 스크롤"
					>
						<ArrowUp size={14} />
					</button>

					<button
						type="button"
						className="btn btn-secondary btn-sm"
						onClick={() => window.dispatchEvent(new CustomEvent(SCROLL_COMMENT_FEED_BOTTOM_EVENT))}
						title="댓글 끝으로"
						aria-label="댓글 끝으로 스크롤"
					>
						<ArrowDown size={14} />
					</button>
				</div>
			</div>
		</div>
	);
}
