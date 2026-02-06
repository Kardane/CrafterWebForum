'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface LikeButtonProps {
	postId: number;
	initialLikes: number;
	initialLiked: boolean;
}

export default function LikeButton({ postId, initialLikes, initialLiked }: LikeButtonProps) {
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

	return (
		<button
			onClick={handleToggleLike}
			disabled={isLoading}
			className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded transition-all duration-200 ${liked
					? 'bg-accent text-white'
					: 'bg-bg-secondary text-text-secondary hover:bg-bg-tertiary'
				} disabled:opacity-50`}
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
