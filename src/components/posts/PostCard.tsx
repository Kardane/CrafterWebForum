"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { MessageSquare } from "lucide-react";
import LikeButton from "./LikeButton";
import PostSubscriptionButton from "./PostSubscriptionButton";
import SafeImage from "@/components/ui/SafeImage";
import { extractFirstImage, getPreviewText } from "@/lib/utils";
import { getBoardLabel, type PostBoardType } from "@/lib/post-board";

interface PostCardProps {
	id: number;
	title: string;
	content?: string;
	preview?: string;
	thumbnailUrl?: string | null;
	authorName: string;
	authorUuid?: string | null;
	createdAt: string | Date;
	updatedAt: string | Date;
	viewCount: number;
	likeCount: number;
	commentCount: number;
	board: PostBoardType;
	serverAddress?: string | null;
	tags: string[];
	unreadCount?: number;
	userLiked?: boolean;
	initialSubscribed?: boolean;
	onNavigate?: (postId: number) => void;
}

export default function PostCard({
	id,
	title,
	content,
	preview,
	thumbnailUrl,
	authorName,
	authorUuid,
	createdAt,
	updatedAt,
	likeCount,
	commentCount,
	board,
	serverAddress,
	tags,
	unreadCount = 0,
	userLiked,
	initialSubscribed = false,
	onNavigate,
}: PostCardProps) {
	const thumb = thumbnailUrl ?? (content ? extractFirstImage(content) : null);
	const previewText = preview ?? (content ? getPreviewText(content) : "");
	const activityDate = updatedAt || createdAt;
	const timeAgo = formatDistanceToNow(new Date(activityDate), {
		addSuffix: true,
		locale: ko,
	});
	const detailHref = `/posts/${id}`;

	const isSinmungo = board === "sinmungo";
	const boardLabel = getBoardLabel(board);

	return (
		<Link
			href={detailHref}
			className="block"
			onClick={() => {
				onNavigate?.(id);
			}}
		>
			<div className="bg-bg-secondary rounded-lg border border-bg-tertiary p-4 hover:border-accent hover:shadow-md transition-all duration-200 cursor-pointer flex gap-4 h-full">

				<div className="flex-1 flex flex-col min-w-0">
					<div className="flex flex-col gap-1 mb-2">
					<div className="flex flex-wrap items-center gap-1.5 mb-1">
							<span className="px-2 py-[2px] rounded text-[10px] font-semibold bg-accent/15 text-accent">
								{boardLabel}
							</span>
							{!isSinmungo && tags.map((tag) => (
								<span
									key={tag}
									className="px-2 py-[2px] rounded text-[10px] font-medium bg-bg-tertiary text-text-secondary"
								>
									{tag}
								</span>
							))}
							{isSinmungo && serverAddress && (
								<button
									type="button"
									onClick={(event) => {
										event.preventDefault();
										event.stopPropagation();
										void navigator.clipboard?.writeText(serverAddress);
									}}
									className="rounded border border-border bg-bg-tertiary px-2 py-[2px] text-[10px] font-medium text-text-secondary hover:bg-bg-primary hover:text-text-primary"
								>
									{serverAddress}
								</button>
							)}
						</div>

						<h3 className="text-base font-bold text-text-primary truncate">{title}</h3>

						<div className="text-sm text-text-muted line-clamp-2 break-all">
							<span className="font-medium text-text-secondary mr-2">{authorName}:</span>
							{previewText}
						</div>
					</div>

					<div className="mt-auto flex items-center gap-4 text-xs text-text-muted font-medium">
						<div
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
							}}
							className="flex items-center"
						>
							<LikeButton
								postId={id}
								initialLikes={likeCount}
								initialLiked={!!userLiked}
								variant="legacy"
								className="!px-2 !py-0.5 !rounded-md h-auto text-xs"
							/>
						</div>
						<div
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
							}}
							className="flex items-center"
						>
							<PostSubscriptionButton
								postId={id}
								initialSubscribed={initialSubscribed}
								variant="icon"
								sidebarFallbackItem={{
									title,
									href: `/posts/${id}`,
									board,
									serverAddress: serverAddress ?? null,
									author: {
										nickname: authorName,
										minecraftUuid: authorUuid ?? null,
									},
									commentCount,
									latestCommentId: null,
								}}
							/>
						</div>
						<div className="flex items-center gap-1">
							<MessageSquare size={14} />
							<span>{commentCount}</span>
						</div>
						<span>{timeAgo}</span>

						{unreadCount > 0 && (
							<span className="text-error font-bold flex items-center gap-1">
								• 새 메시지 {unreadCount}개
							</span>
						)}
					</div>
				</div>

				{thumb && (
					<div className="w-24 h-24 flex-shrink-0 rounded-md overflow-hidden bg-bg-tertiary border border-border">
						<SafeImage
							src={thumb}
							alt="thumbnail"
							width={96}
							height={96}
							className="w-full h-full object-cover"
							loading="lazy"
						/>
					</div>
				)}

			</div>
		</Link>
	);
}
