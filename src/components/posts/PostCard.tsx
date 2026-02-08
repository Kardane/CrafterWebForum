"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { MessageSquare } from "lucide-react";
import LikeButton from "./LikeButton";
import { extractFirstImage, getPreviewText } from "@/lib/utils";
import classNames from "classnames";

interface PostCardProps {
	id: number;
	title: string;
	content: string;
	authorName: string;
	authorUuid?: string;
	createdAt: string | Date;
	viewCount: number;
	likeCount: number;
	commentCount: number;
	tags: string[];
	unreadCount?: number;
	userLiked?: boolean;
}

export default function PostCard({
	id,
	title,
	content,
	authorName,
	authorUuid,
	createdAt,
	likeCount,
	commentCount,
	tags,
	unreadCount = 0,
	userLiked,
}: PostCardProps) {
	const thumb = extractFirstImage(content);
	const preview = getPreviewText(content);
	const timeAgo = formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: ko });

	return (
		<Link href={`/post/${id}`} className="block">
			<div className="bg-bg-secondary rounded-lg border border-bg-tertiary p-4 hover:border-border transition-colors duration-200 cursor-pointer flex gap-4 h-full">

				<div className="flex-1 flex flex-col min-w-0">
					<div className="flex flex-col gap-1 mb-2">
						<div className="flex flex-wrap gap-1.5 mb-1">
							{tags.map((tag) => (
								<span
									key={tag}
									className="px-2 py-0.5 rounded text-[11px] font-medium bg-bg-tertiary text-text-secondary"
								>
									{tag}
								</span>
							))}
						</div>

						<h3 className="text-base font-bold text-text-primary truncate">{title}</h3>

						<div className="text-sm text-text-muted line-clamp-2 break-all">
							<span className="font-medium text-text-secondary mr-2">{authorName}:</span>
							{preview}
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
								variant="ghost"
								className="!p-0 !bg-transparent gap-1 hover:text-accent h-auto text-xs"
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
						<img
							src={thumb}
							alt="thumbnail"
							className="w-full h-full object-cover"
							loading="lazy"
						/>
					</div>
				)}

			</div>
		</Link>
	);
}
