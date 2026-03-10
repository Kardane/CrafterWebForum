"use client";

import { useEffect, useState } from "react";
import classNames from "classnames";
import { useSession } from "next-auth/react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import {
	hasPostSubscriptionFallback,
	removePostSubscriptionFallback,
	upsertPostSubscriptionFallback,
} from "@/lib/post-subscription-fallback";
import { toSessionUserId } from "@/lib/session-user";

interface SidebarFallbackPostItem {
	title: string;
	href: string;
	board: "develope" | "sinmungo";
	serverAddress: string | null;
	author: {
		nickname: string;
		minecraftUuid: string | null;
	};
	commentCount: number;
	latestCommentId: number | null;
}

interface PostSubscriptionButtonProps {
	postId: number;
	initialSubscribed: boolean;
	variant?: "icon" | "button";
	className?: string;
	onChange?: (nextSubscribed: boolean) => void;
	sidebarFallbackItem?: SidebarFallbackPostItem;
}

export default function PostSubscriptionButton({
	postId,
	initialSubscribed,
	variant = "icon",
	className,
	onChange,
	sidebarFallbackItem,
}: PostSubscriptionButtonProps) {
	const { data: session } = useSession();
	const sessionUserId = toSessionUserId(session?.user?.id);
	const [isSubscribed, setIsSubscribed] = useState(initialSubscribed);
	const [isPending, setIsPending] = useState(false);

	useEffect(() => {
		const fallbackSubscribed = sessionUserId ? hasPostSubscriptionFallback(sessionUserId, postId) : false;
		setIsSubscribed(initialSubscribed || fallbackSubscribed);
	}, [initialSubscribed, postId, sessionUserId]);

	const toggleSubscription = async () => {
		if (isPending) {
			return;
		}

		const nextSubscribed = !isSubscribed;
		setIsPending(true);
		try {
			const response = await fetch(`/api/posts/${postId}/subscription`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ enabled: nextSubscribed }),
			});

			if (!response.ok) {
				throw new Error(`failed_to_toggle_subscription:${response.status}`);
			}
			const payload = (await response.json()) as { fallbackLocalOnly?: boolean; enabled?: boolean };

			setIsSubscribed(nextSubscribed);
			onChange?.(nextSubscribed);

			if (payload.fallbackLocalOnly) {
				if (sessionUserId && sidebarFallbackItem) {
					if (nextSubscribed) {
						upsertPostSubscriptionFallback(sessionUserId, {
							postId,
							title: sidebarFallbackItem.title,
							href: sidebarFallbackItem.href,
							board: sidebarFallbackItem.board,
							serverAddress: sidebarFallbackItem.serverAddress,
							lastActivityAt: new Date().toISOString(),
							author: {
								nickname: sidebarFallbackItem.author.nickname,
								minecraftUuid: sidebarFallbackItem.author.minecraftUuid,
							},
							sourceFlags: {
								authored: false,
								subscribed: true,
							},
							isSubscribed: true,
							commentCount: sidebarFallbackItem.commentCount,
							newCommentCount: 0,
							latestCommentId: sidebarFallbackItem.latestCommentId,
						});
					} else {
						removePostSubscriptionFallback(sessionUserId, postId);
					}
				}
				window.dispatchEvent(
					new CustomEvent("sidebarTrackedPostsFallbackChanged", {
						detail: {
							postId,
							enabled: nextSubscribed,
							item: sidebarFallbackItem,
						},
					})
				);
			} else {
				if (sessionUserId) {
					removePostSubscriptionFallback(sessionUserId, postId);
				}
				window.dispatchEvent(new CustomEvent("sidebarTrackedPostsChanged"));
			}
		} catch (error) {
			console.error("[post-subscription] failed to toggle", error);
		} finally {
			setIsPending(false);
		}
	};

	const buttonClassName =
		variant === "button"
			? classNames("btn btn-secondary btn-sm", className)
			: classNames(
				"inline-flex h-7 w-7 items-center justify-center rounded transition-colors",
				isSubscribed
					? "text-accent hover:bg-bg-secondary"
					: "text-text-muted hover:bg-bg-secondary hover:text-text-primary",
				isPending ? "cursor-wait opacity-70" : "",
				className
			);

	return (
		<button
			type="button"
			onClick={() => {
				void toggleSubscription();
			}}
			disabled={isPending}
			className={buttonClassName}
			title={isSubscribed ? "포스트 알림 끄기" : "포스트 알림 켜기"}
			aria-label={isSubscribed ? "포스트 알림 끄기" : "포스트 알림 켜기"}
		>
			{isPending ? (
				<Loader2 size={14} className="animate-spin" />
			) : isSubscribed ? (
				<Bell size={14} />
			) : (
				<BellOff size={14} />
			)}
		</button>
	);
}
