"use client";

import { useState } from "react";

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

interface PollModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (pollData: PollData) => void;
}

/**
 * 투표 생성 모달 - 레거시 스타일
 */
export default function PollModal({ isOpen, onClose, onSubmit }: PollModalProps) {
	const [question, setQuestion] = useState("");
	const [options, setOptions] = useState<string[]>(["", ""]);
	const [duration, setDuration] = useState(24);
	const [allowMulti, setAllowMulti] = useState(false);

	// 옵션 추가
	const addOption = () => {
		if (options.length >= 10) {
			alert("최대 10개까지 설정 가능합니다");
			return;
		}
		setOptions([...options, ""]);
	};

	// 옵션 삭제
	const removeOption = (index: number) => {
		if (options.length <= 2) {
			alert("최소 2개의 응답이 필요합니다");
			return;
		}
		setOptions(options.filter((_, i) => i !== index));
	};

	// 옵션 수정
	const updateOption = (index: number, value: string) => {
		const newOptions = [...options];
		newOptions[index] = value;
		setOptions(newOptions);
	};

	// 리셋
	const resetForm = () => {
		setQuestion("");
		setOptions(["", ""]);
		setDuration(24);
		setAllowMulti(false);
	};

	// 제출
	const handleSubmit = () => {
		if (!question.trim()) {
			alert("질문을 입력해주세요.");
			return;
		}

		const validOptions = options.filter((opt) => opt.trim());
		if (validOptions.length < 2) {
			alert("최소 2개의 응답을 입력해주세요.");
			return;
		}

		const pollData: PollData = {
			question: question.trim(),
			options: validOptions.map((opt, idx) => ({
				id: idx,
				text: opt.trim(),
				votes: 0
			})),
			settings: {
				duration_hours: duration,
				allow_multi: allowMulti,
				created_at: new Date().toISOString()
			},
			voters: {}
		};

		onSubmit(pollData);
		resetForm();
		onClose();
	};

	if (!isOpen) return null;

	return (
		<div className="poll-modal-overlay" onClick={onClose}>
			<div className="poll-modal" onClick={(e) => e.stopPropagation()}>
				{/* 헤더 */}
				<div className="poll-modal-header">
					<span className="poll-modal-title">투표 만들기</span>
					<button className="poll-modal-close" onClick={onClose}>
						&times;
					</button>
				</div>

				{/* 콘텐츠 */}
				<div className="poll-modal-content">
					{/* 질문 */}
					<label className="poll-label">질문</label>
					<div className="poll-input-wrapper">
						<input
							type="text"
							className="poll-input"
							placeholder="어떤 질문을 하고 싶으신가요?"
							maxLength={300}
							value={question}
							onChange={(e) => setQuestion(e.target.value)}
						/>
					</div>

					{/* 답변 옵션 */}
					<label className="poll-label">답변</label>
					<div className="poll-options-list">
						{options.map((opt, index) => (
							<div key={index} className="poll-option-row">
								<input
									type="text"
									className="poll-input"
									placeholder="응답 입력하기"
									value={opt}
									onChange={(e) => updateOption(index, e.target.value)}
								/>
								<button
									className="poll-option-delete"
									onClick={() => removeOption(index)}
								>
									🗑
								</button>
							</div>
						))}
					</div>
					<button className="poll-add-btn" onClick={addOption}>
						+ 다른 응답 추가하기
					</button>

					{/* 지속 시간 */}
					<label className="poll-label">지속 시간</label>
					<select
						className="poll-select"
						value={duration}
						onChange={(e) => setDuration(Number(e.target.value))}
					>
						<option value={0.05}>3분</option>
						<option value={1}>1시간</option>
						<option value={4}>4시간</option>
						<option value={8}>8시간</option>
						<option value={24}>24시간</option>
						<option value={72}>3일</option>
					</select>

					{/* 중복 투표 */}
					<div
						className="poll-checkbox-wrapper"
						onClick={() => setAllowMulti(!allowMulti)}
					>
						<input
							type="checkbox"
							className="poll-checkbox-input"
							checked={allowMulti}
							onChange={() => setAllowMulti(!allowMulti)}
						/>
						<label className="poll-checkbox-label">중복 응답 허용</label>
					</div>
				</div>

				{/* 푸터 */}
				<div className="poll-modal-footer">
					<button className="poll-submit-btn" onClick={handleSubmit}>
						투표 생성
					</button>
				</div>
			</div>

			{/* 스타일 */}
			<style jsx>{`
				.poll-modal-overlay {
					position: fixed;
					inset: 0;
					background: rgba(0, 0, 0, 0.7);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 9999;
				}

				.poll-modal {
					background: var(--bg-secondary);
					border-radius: 8px;
					width: 90%;
					max-width: 400px;
					box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
				}

				.poll-modal-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 16px;
					border-bottom: 1px solid var(--border);
				}

				.poll-modal-title {
					font-size: 1.1rem;
					font-weight: 600;
					color: var(--text-primary);
				}

				.poll-modal-close {
					background: none;
					border: none;
					font-size: 1.5rem;
					color: var(--text-muted);
					cursor: pointer;
				}

				.poll-modal-close:hover {
					color: var(--text-primary);
				}

				.poll-modal-content {
					padding: 16px;
				}

				.poll-label {
					display: block;
					font-size: 0.85rem;
					font-weight: 600;
					color: var(--text-secondary);
					margin-bottom: 6px;
					margin-top: 12px;
				}

				.poll-label:first-child {
					margin-top: 0;
				}

				.poll-input-wrapper {
					margin-bottom: 8px;
				}

				.poll-input {
					width: 100%;
					padding: 10px 12px;
					background: var(--bg-tertiary);
					border: 1px solid var(--border);
					border-radius: 4px;
					color: var(--text-primary);
					font-size: 0.9rem;
				}

				.poll-input:focus {
					outline: none;
					border-color: var(--accent);
				}

				.poll-options-list {
					display: flex;
					flex-direction: column;
					gap: 8px;
				}

				.poll-option-row {
					display: flex;
					gap: 8px;
				}

				.poll-option-delete {
					padding: 8px 12px;
					background: var(--bg-tertiary);
					border: 1px solid var(--border);
					border-radius: 4px;
					cursor: pointer;
				}

				.poll-option-delete:hover {
					background: var(--error);
				}

				.poll-add-btn {
					width: 100%;
					padding: 10px;
					background: transparent;
					border: 1px dashed var(--border);
					border-radius: 4px;
					color: var(--text-muted);
					cursor: pointer;
					margin-top: 8px;
				}

				.poll-add-btn:hover {
					background: var(--bg-tertiary);
					color: var(--text-primary);
				}

				.poll-select {
					width: 100%;
					padding: 10px 12px;
					background: var(--bg-tertiary);
					border: 1px solid var(--border);
					border-radius: 4px;
					color: var(--text-primary);
					font-size: 0.9rem;
				}

				.poll-checkbox-wrapper {
					display: flex;
					align-items: center;
					gap: 8px;
					margin-top: 12px;
					cursor: pointer;
				}

				.poll-checkbox-input {
					width: 16px;
					height: 16px;
				}

				.poll-checkbox-label {
					font-size: 0.9rem;
					color: var(--text-secondary);
				}

				.poll-modal-footer {
					padding: 16px;
					border-top: 1px solid var(--border);
				}

				.poll-submit-btn {
					width: 100%;
					padding: 12px;
					background: var(--accent);
					border: none;
					border-radius: 4px;
					color: white;
					font-size: 1rem;
					font-weight: 500;
					cursor: pointer;
				}

				.poll-submit-btn:hover {
					background: var(--accent-hover);
				}
			`}</style>
		</div>
	);
}
