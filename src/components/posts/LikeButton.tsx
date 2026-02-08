'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LikeButtonProps {
	postId: number;
	initialLikes: number;
	initialLiked: boolean;
	className?: string; // 추가 스타일
	variant?: "default" | "ghost"; // 스타일 변형
}

export default function LikeButton({
	postId,
	initialLikes,
	initialLiked,
	className = "",
	variant = "default"
}: LikeButtonProps) {
	const [likes, setLikes] = useState(initialLikes);
	const [liked, setLiked] = useState(initialLiked);
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();

	const handleToggleLike = async () => {
		if (isLoading) return;

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
		? `px-3 py-1.5 rounded ${liked ? 'bg-accent text-white' : 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'}`
		: `${liked ? 'text-accent font-bold' : 'text-text-muted hover:text-text-primary'}`;

	return (
		<button
			onClick={handleToggleLike}
			disabled={isLoading}
			className={`${baseClasses} ${variantClasses} ${className}`}
		>
			<Star
				className="w-4 h-4"
				fill={liked ? 'currentColor' : 'none'}
				stroke="currentColor"
				strokeWidth={2}
			/>
			<span className="text-sm font-medium">{likes}</span>
		</button>
	);
}
