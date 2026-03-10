interface UserStatsProps {
	stats: {
		posts: number;
		developePosts: number;
		sinmungoPosts: number;
		comments: number;
		likesReceived: number;
	};
}

export default function UserStats({ stats }: UserStatsProps) {
	return (
		<div className="grid grid-cols-2 gap-4 md:grid-cols-5">
			<div className="bg-bg-tertiary rounded-lg p-4 text-center border border-border">
				<div className="text-3xl font-bold text-accent mb-1">{stats.posts}</div>
				<div className="text-sm text-text-muted">전체 게시글</div>
			</div>
			<div className="bg-bg-tertiary rounded-lg p-4 text-center border border-border">
				<div className="text-3xl font-bold text-accent mb-1">{stats.developePosts}</div>
				<div className="text-sm text-text-muted">개발 포스트</div>
			</div>
			<div className="bg-bg-tertiary rounded-lg p-4 text-center border border-border">
				<div className="text-3xl font-bold text-accent mb-1">{stats.sinmungoPosts}</div>
				<div className="text-sm text-text-muted">신문고 글</div>
			</div>
			<div className="bg-bg-tertiary rounded-lg p-4 text-center border border-border">
				<div className="text-3xl font-bold text-accent mb-1">{stats.comments}</div>
				<div className="text-sm text-text-muted">내 댓글</div>
			</div>
			<div className="bg-bg-tertiary rounded-lg p-4 text-center border border-border">
				<div className="text-3xl font-bold text-accent mb-1">{stats.likesReceived}</div>
				<div className="text-sm text-text-muted">내 포스트 추천</div>
			</div>
		</div>
	);
}
