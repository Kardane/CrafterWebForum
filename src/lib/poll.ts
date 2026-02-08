/**
 * 투표 데이터 유틸리티
 * - Poll JSON 파싱/직렬화
 * - 투표 로직
 */

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

export interface PollData {
	question: string;
	options: PollOption[];
	settings: PollSettings;
	voters: Record<string, number[]>;
}

/**
 * 댓글 내용에서 투표 데이터 추출
 */
export function extractPollData(content: string): PollData | null {
	const match = content.match(/\[POLL_JSON\]([\s\S]*?)\[\/POLL_JSON\]/);
	if (!match) return null;

	try {
		return JSON.parse(match[1]);
	} catch (e) {
		console.error("Failed to parse poll data", e);
		return null;
	}
}

/**
 * 투표 데이터를 댓글 내용 형식으로 변환
 */
export function serializePollData(pollData: PollData): string {
	return `[POLL_JSON]${JSON.stringify(pollData)}[/POLL_JSON]`;
}

/**
 * 댓글 내용에서 투표 데이터 업데이트
 */
export function updatePollInContent(content: string, pollData: PollData): string {
	const pollString = serializePollData(pollData);
	return content.replace(/\[POLL_JSON\][\s\S]*?\[\/POLL_JSON\]/, pollString);
}

/**
 * 투표 처리
 * @returns 업데이트된 PollData
 */
export function processVote(
	pollData: PollData,
	userId: string,
	optionId: number
): PollData {
	const newPollData = { ...pollData };

	// 투표자 객체 초기화
	if (!newPollData.voters) {
		newPollData.voters = {};
	}

	// 사용자 투표 정보
	let userVotes = newPollData.voters[userId] || [];

	// 다중 선택 허용 여부에 따른 처리
	if (newPollData.settings.allow_multi) {
		// 다중 선택: 토글 방식
		if (userVotes.includes(optionId)) {
			userVotes = userVotes.filter((v) => v !== optionId);
		} else {
			userVotes.push(optionId);
		}
	} else {
		// 단일 선택: 토글 또는 교체
		if (userVotes.includes(optionId)) {
			userVotes = [];
		} else {
			userVotes = [optionId];
		}
	}

	newPollData.voters[userId] = userVotes;

	// 투표 수 재계산
	newPollData.options = newPollData.options.map((opt) => ({
		...opt,
		votes: 0
	}));

	Object.values(newPollData.voters).forEach((votes) => {
		votes.forEach((voteId) => {
			const option = newPollData.options.find((o) => o.id === voteId);
			if (option) {
				option.votes++;
			}
		});
	});

	return newPollData;
}

/**
 * 투표 종료 여부 확인
 */
export function isPollEnded(pollData: PollData): boolean {
	const created = new Date(pollData.settings.created_at);
	const now = new Date();
	const hoursDiff = (now.getTime() - created.getTime()) / 1000 / 60 / 60;
	return hoursDiff > pollData.settings.duration_hours;
}

/**
 * 투표 포함 여부 확인
 */
export function hasPoll(content: string): boolean {
	return content.includes("[POLL_JSON]");
}
