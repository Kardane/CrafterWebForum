"use client";


import { useState } from "react";
import { useSession } from "next-auth/react";

interface PollOption {
	id: number;
	text: string;
	votes: number;
}

interface PollSettings {
	duration_hours: number;
	allow_multi: boolean;
	created_at: string;
}

interface PollData {
	question: string;
	options: PollOption[];
	settings: PollSettings;
	voters: Record<string, number[]>;
}

interface PollCardProps {
	pollData: PollData;
	commentId: number;
	onVote?: (optionId: number) => Promise<void> | void;
}

/**
 * 투표 결과 카드 컴포넌트 - 레거시 스타일
 */
export default function PollCard({ pollData, onVote }: PollCardProps) {
	const { data: session } = useSession();
	const userId = session?.user?.id?.toString() || "";
	const [isVoting, setIsVoting] = useState(false);

	// 사용자 투표 정보
	const userVotes = pollData.voters[userId] || [];

	// 총 투표 수
	const totalVotes = pollData.options.reduce((acc, o) => acc + o.votes, 0);

	// 종료 여부 계산
	const created = new Date(pollData.settings.created_at);
	const now = new Date();
	const hoursDiff = (now.getTime() - created.getTime()) / 1000 / 60 / 60;
	const isEnded = hoursDiff > pollData.settings.duration_hours;
	const remainingHours = Math.max(0, Math.ceil(pollData.settings.duration_hours - hoursDiff));

	// 시간 텍스트
	let timeText = "";
	if (isEnded) {
		timeText = "투표 종료";
	} else if (remainingHours >= 24) {
		timeText = `${Math.floor(remainingHours / 24)}일 남음`;
	} else {
		timeText = `${remainingHours}시간 남음`;
	}

	// 투표 핸들러
	const handleVote = async (optionId: number) => {
		if (!session?.user) {
			alert("로그인이 필요합니다");
			return;
		}
		if (isEnded) {
			alert("투표가 종료되었습니다");
			return;
		}
		if (!onVote || isVoting) {
			return;
		}
		setIsVoting(true);
		try {
			await onVote(optionId);
		} finally {
			setIsVoting(false);
		}
	};

	// HTML 이스케이프
	const escapeHtml = (text: string) => {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	};

	return (
		<div className={`poll-card ${pollData.settings.allow_multi ? "multi" : ""}`}>
			{/* 질문 */}
			<div className="poll-card-question">{escapeHtml(pollData.question)}</div>

			{/* 옵션 목록 */}
			<div className="poll-card-options">
				{pollData.options.map((opt) => {
					const isVoted = userVotes.includes(opt.id);
					const safePercent = totalVotes === 0 ? 0 : Math.round((opt.votes / totalVotes) * 100);

					return (
						<div
							key={opt.id}
							className={`poll-card-option ${isVoted ? "voted" : ""} ${isVoting ? "disabled" : ""}`}
							onClick={() => void handleVote(opt.id)}
						>
							{/* 프로그레스 바 */}
							<div
								className="poll-progress-bar"
								style={{ width: `${safePercent}%` }}
							/>

							{/* 콘텐츠 */}
							<div className="poll-option-content">
								<div className="poll-checkbox-indicator" />
								<div className="poll-option-text">{escapeHtml(opt.text)}</div>
								<div className="poll-option-stats">
									{opt.votes}표 {safePercent}%
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* 푸터 */}
			<div className="poll-footer">
				<span>
					{totalVotes}표 • {timeText}
				</span>
			</div>

			{/* 스타일 */}
			<style jsx>{`
				.poll-card {
					background: var(--bg-tertiary);
					border-radius: 8px;
					padding: 16px;
					margin: 12px 0;
				}

				.poll-card-question {
					font-size: 1rem;
					font-weight: 600;
					color: var(--text-primary);
					margin-bottom: 12px;
				}

				.poll-card-options {
					display: flex;
					flex-direction: column;
					gap: 8px;
				}

				.poll-card-option {
					position: relative;
					padding: 10px 12px;
					background: var(--bg-secondary);
					border: 1px solid var(--border);
					border-radius: 6px;
					cursor: pointer;
					overflow: hidden;
					transition: border-color 0.2s;
				}

				.poll-card-option:hover {
					border-color: var(--accent);
				}

				.poll-card-option.disabled {
					cursor: wait;
					opacity: 0.7;
				}

				.poll-card-option.voted {
					border-color: var(--accent);
					background: rgba(139, 35, 50, 0.1);
				}

				.poll-progress-bar {
					position: absolute;
					top: 0;
					left: 0;
					height: 100%;
					background: var(--accent);
					opacity: 0.15;
					transition: width 0.3s ease;
				}

				.poll-option-content {
					position: relative;
					display: flex;
					align-items: center;
					gap: 8px;
					z-index: 1;
				}

				.poll-checkbox-indicator {
					width: 16px;
					height: 16px;
					border: 2px solid var(--border);
					border-radius: 50%;
					flex-shrink: 0;
				}

				.poll-card-option.voted .poll-checkbox-indicator {
					background: var(--accent);
					border-color: var(--accent);
				}

				.poll-card.multi .poll-checkbox-indicator {
					border-radius: 3px;
				}

				.poll-option-text {
					flex: 1;
					font-size: 0.9rem;
					color: var(--text-primary);
				}

				.poll-option-stats {
					font-size: 0.8rem;
					color: var(--text-muted);
					white-space: nowrap;
				}

				.poll-footer {
					margin-top: 12px;
					padding-top: 8px;
					border-top: 1px solid var(--border);
					font-size: 0.85rem;
					color: var(--text-muted);
				}
			`}</style>
		</div>
	);
}
