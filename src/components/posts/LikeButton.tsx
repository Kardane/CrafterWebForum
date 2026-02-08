'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useOptionalPostLikeState } from './PostLikeStateProvider';

interface ControlledLikeState {
	likes: number;
	liked: boolean;
	isLoading: boolean;
}

interface LikeButtonProps {
	postId: number;
	initialLikes: number;
	initialLiked: boolean;
	className?: string; // 추가 스타일
	variant?: "default" | "ghost" | "legacy"; // 스타일 변형
	state?: ControlledLikeState;
	onToggle?: () => Promise<void> | void;
}

export default function LikeButton({
	postId,
	initialLikes,
	initialLiked,
	className = "",
	variant = "default",
	state,
	onToggle,
}: LikeButtonProps) {
	const sharedLikeState = useOptionalPostLikeState();
	const useSharedLikeState =
		!state &&
		!onToggle &&
		sharedLikeState !== null &&
		sharedLikeState.postId === postId;

	const [likes, setLikes] = useState(initialLikes);
	const [liked, setLiked] = useState(initialLiked);
	const [isLoading, setIsLoading] = useState(false);

	useEffect(() => {
		if (!state && !useSharedLikeState) {
			setLikes(initialLikes);
			setLiked(initialLiked);
			setIsLoading(false);
		}
	}, [initialLikes, initialLiked, state, useSharedLikeState]);

	const resolvedLikes = state
		? state.likes
		: useSharedLikeState
			? sharedLikeState.likes
			: likes;
	const resolvedLiked = state
		? state.liked
		: useSharedLikeState
			? sharedLikeState.liked
			: liked;
	const resolvedIsLoading = state
		? state.isLoading
		: useSharedLikeState
			? sharedLikeState.isLoading
			: isLoading;

	const handleToggleLike = async () => {
		if (resolvedIsLoading) return;

		if (state && onToggle) {
			await onToggle();
			return;
		}

		if (useSharedLikeState) {
			await sharedLikeState.toggleLike();
			return;
		}

		// 낙관적 업데이트
		const prevLikes = likes;
		const prevLiked = liked;
		setLiked(!liked);
		setLikes(liked ? likes - 1 : likes + 1);
		setIsLoading(true);

		try {
			const res = await fetch(`/api/posts/${postId}/like`, {
				method: 'POST',
			});

			if (!res.ok) {
				throw new Error('Failed to toggle like');
			}

			const data = await res.json();
			setLikes(data.likes);
			setLiked(data.liked);
		} catch (error) {
			console.error('Like toggle error:', error);
			// 롤백
			setLikes(prevLikes);
			setLiked(prevLiked);
			alert('좋아요 처리에 실패했습니다.');
		} finally {
			setIsLoading(false);
		}
	};

	// 스타일 클래스 결정
	const baseClasses = "inline-flex items-center gap-1.5 transition-all duration-200 disabled:opacity-50";
	const variantClasses = variant === "default"
		? `px-3 py-1.5 rounded-md border ${resolvedLiked
			? "bg-[#2f3338] border-[#484d54] text-white hover:bg-[#3a3f45]"
			: "bg-[#25292f] border-[#3f444b] text-text-secondary hover:bg-[#31363d] hover:text-white"
		}`
		: variant === "legacy"
			? `rounded px-2 py-1 border border-transparent ${resolvedLiked
				? "text-warning hover:bg-bg-tertiary"
				: "text-text-muted hover:bg-bg-tertiary hover:text-warning"
			}`
			: `${resolvedLiked ? "text-accent font-bold" : "text-text-muted hover:text-text-primary"}`;

	const iconFill = resolvedLiked
		? variant === "legacy"
			? "currentColor"
			: "#a8b2bd"
		: "none";
	const iconStroke = resolvedLiked
		? variant === "legacy"
			? "currentColor"
			: "#a8b2bd"
		: "currentColor";

	return (
		<button
			onClick={handleToggleLike}
			disabled={resolvedIsLoading}
			className={`${baseClasses} ${variantClasses} ${className}`}
		>
			<Star
				className="w-4 h-4"
				fill={iconFill}
				stroke={iconStroke}
				strokeWidth={2}
			/>
			<span className="text-sm font-medium">{resolvedLikes}</span>
		</button>
	);
}
