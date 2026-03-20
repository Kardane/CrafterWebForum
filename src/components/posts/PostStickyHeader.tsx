"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, MessageCircle, Pin } from "lucide-react";
import LikeButton from "./LikeButton";
import PostSubscriptionButton from "./PostSubscriptionButton";
import { OPEN_PINNED_COMMENTS_EVENT, SCROLL_COMMENT_FEED_BOTTOM_EVENT } from "@/constants/comments";
import { type PostBoardType } from "@/lib/post-board";

interface PostStickyHeaderProps {
	postId: number;
	title: string;
	authorName: string;
	authorMinecraftUuid?: string | null;
	board?: PostBoardType;
	serverAddress?: string | null;
	createdAt: string | Date;
	commentCount: number;
	initialLikes: number;
	initialLiked: boolean;
	initialSubscribed: boolean;
	triggerId?: string;
	topOffsetClassName?: string;
	observerOffsetTop?: number;
	backHref?: string;
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
	authorMinecraftUuid = null,
	board = "develope",
	serverAddress = null,
	createdAt,
	commentCount,
	initialLikes,
	initialLiked,
	initialSubscribed,
	triggerId = "post-header-trigger",
	topOffsetClassName = "top-header",
	observerOffsetTop = 56,
	backHref = "/",
}: PostStickyHeaderProps) {
	void triggerId;
	void topOffsetClassName;
	void observerOffsetTop;

	return (
		<>
			<div className="h-[60px] md:hidden" aria-hidden="true" />
			<div className="fixed inset-x-0 top-0 z-[70] px-3 pt-2 md:sticky md:top-0 md:z-[70] md:px-0 md:pt-0 transition-opacity duration-200 opacity-100">
				<div className="rounded-b-lg border-x border-b border-border bg-bg-secondary/95 px-3 py-2 shadow-sm backdrop-blur">
					<div className="flex items-center gap-3">
						<Link href={backHref} className="btn btn-secondary btn-sm" title="목록" aria-label="목록으로 이동">
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

						<PostSubscriptionButton
							postId={postId}
							initialSubscribed={initialSubscribed}
							variant="button"
							sidebarFallbackItem={{
								title,
								href: `/posts/${postId}`,
								board,
								serverAddress,
								author: {
									nickname: authorName,
									minecraftUuid: authorMinecraftUuid,
								},
								commentCount,
								latestCommentId: null,
							}}
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
		</>
	);
}
