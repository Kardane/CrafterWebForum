"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRealtimeBroadcast } from "@/lib/realtime/useRealtimeBroadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";

interface PostLikeStateContextValue {
	postId: number;
	likes: number;
	liked: boolean;
	isLoading: boolean;
	toggleLike: () => Promise<void>;
}

interface PostLikeStateProviderProps {
	postId: number;
	initialLikes: number;
	initialLiked: boolean;
	children: React.ReactNode;
}

const PostLikeStateContext = createContext<PostLikeStateContextValue | null>(null);

export function PostLikeStateProvider({
	postId,
	initialLikes,
	initialLiked,
	children,
}: PostLikeStateProviderProps) {
	const { data: session } = useSession();
	const [likes, setLikes] = useState(initialLikes);
	const [liked, setLiked] = useState(initialLiked);
	const [isLoading, setIsLoading] = useState(false);

	// 포스트가 바뀌면 좋아요 상태를 초기값으로 재동기화
	useEffect(() => {
		setLikes(initialLikes);
		setLiked(initialLiked);
		setIsLoading(false);
	}, [postId, initialLikes, initialLiked]);

	useRealtimeBroadcast(REALTIME_TOPICS.post(postId), {
		[REALTIME_EVENTS.POST_LIKE_TOGGLED]: (payload) => {
			const nextLikes = Number(payload.likes ?? likes);
			if (Number.isFinite(nextLikes)) {
				setLikes(nextLikes);
			}
			const actorUserId = Number(payload.actorUserId ?? 0);
			const sessionUserId = Number(session?.user?.id ?? 0);
			if (actorUserId > 0 && actorUserId === sessionUserId && typeof payload.likedByActor === "boolean") {
				setLiked(payload.likedByActor);
			}
		},
	});

	const toggleLike = useCallback(async () => {
		if (isLoading) return;

		const prevLikes = likes;
		const prevLiked = liked;

		setLiked(!liked);
		setLikes(liked ? likes - 1 : likes + 1);
		setIsLoading(true);

		try {
			const res = await fetch(`/api/posts/${postId}/like`, {
				method: "POST",
			});

			if (!res.ok) {
				throw new Error("Failed to toggle like");
			}

			const data = (await res.json()) as { likes: number; liked: boolean };
			setLikes(data.likes);
			setLiked(data.liked);
		} catch (error) {
			console.error("Like toggle error:", error);
			setLikes(prevLikes);
			setLiked(prevLiked);
			alert("좋아요 처리에 실패했습니다.");
		} finally {
			setIsLoading(false);
		}
	}, [isLoading, liked, likes, postId]);

	const value = useMemo<PostLikeStateContextValue>(
		() => ({
			postId,
			likes,
			liked,
			isLoading,
			toggleLike,
		}),
		[postId, likes, liked, isLoading, toggleLike]
	);

	return <PostLikeStateContext.Provider value={value}>{children}</PostLikeStateContext.Provider>;
}

export function useOptionalPostLikeState(): PostLikeStateContextValue | null {
	return useContext(PostLikeStateContext);
}
