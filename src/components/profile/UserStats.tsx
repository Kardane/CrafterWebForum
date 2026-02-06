interface UserStatsProps {
	stats: {
		posts: number;
		comments: number;
	};
}

export default function UserStats({ stats }: UserStatsProps) {
	return (
		<div className="grid grid-cols-2 gap-4">
			<div className="bg-bg-tertiary rounded-lg p-4 text-center border border-border">
				<div className="text-3xl font-bold text-accent mb-1">{stats.posts}</div>
				<div className="text-sm text-text-muted">내 게시글</div>
			</div>
			<div className="bg-bg-tertiary rounded-lg p-4 text-center border border-border">
				<div className="text-3xl font-bold text-accent mb-1">{stats.comments}</div>
				<div className="text-sm text-text-muted">내 댓글</div>
			</div>
		</div>
	);
}
