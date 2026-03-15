"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { PollData } from "@/lib/poll";
import { useToast } from "@/components/ui/useToast";

interface PollModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (pollData: PollData) => void;
}

export default function PollModal({ isOpen, onClose, onSubmit }: PollModalProps) {
	const { showToast } = useToast();
	const [question, setQuestion] = useState("");
	const [options, setOptions] = useState<string[]>(["", ""]);
	const [duration, setDuration] = useState(24);
	const [allowMulti, setAllowMulti] = useState(false);

	const addOption = () => {
		if (options.length >= 10) {
			showToast({ type: "error", message: "최대 10개까지만 가능" });
			return;
		}
		setOptions((prev) => [...prev, ""]);
	};

	const removeOption = (index: number) => {
		if (options.length <= 2) {
			showToast({ type: "error", message: "최소 2개 응답 필요" });
			return;
		}
		setOptions((prev) => prev.filter((_, optionIndex) => optionIndex !== index));
	};

	const updateOption = (index: number, value: string) => {
		setOptions((prev) => prev.map((item, optionIndex) => (optionIndex === index ? value : item)));
	};

	const resetForm = () => {
		setQuestion("");
		setOptions(["", ""]);
		setDuration(24);
		setAllowMulti(false);
	};

	const handleSubmit = () => {
		if (!question.trim()) {
			showToast({ type: "error", message: "질문을 입력해줘" });
			return;
		}

		const validOptions = options.map((item) => item.trim()).filter(Boolean);
		if (validOptions.length < 2) {
			showToast({ type: "error", message: "응답은 최소 2개 필요함" });
			return;
		}

		const pollData: PollData = {
			question: question.trim(),
			options: validOptions.map((option, index) => ({
				id: index,
				text: option,
				votes: 0,
			})),
			settings: {
				duration_hours: duration,
				allow_multi: allowMulti,
				created_at: new Date().toISOString(),
			},
			voters: {},
		};

		onSubmit(pollData);
		resetForm();
		onClose();
	};

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title="투표 만들기"
			variant="sidebarLike"
			size="md"
			footer={
				<div className="flex justify-end">
					<button type="button" className="btn btn-primary btn-sm" onClick={handleSubmit}>
						투표 생성
					</button>
				</div>
			}
		>
			<div className="space-y-3">
				<div className="space-y-1.5">
					<label className="text-xs font-semibold text-text-secondary">질문</label>
					<input
						type="text"
						className="input-base h-10 text-sm"
						placeholder="어떤 질문을 하고 싶어"
						maxLength={300}
						value={question}
						onChange={(event) => setQuestion(event.target.value)}
					/>
				</div>

				<div className="space-y-1.5">
					<label className="text-xs font-semibold text-text-secondary">답변</label>
					<div className="space-y-2">
						{options.map((option, index) => (
							<div key={index} className="flex gap-2">
								<input
									type="text"
									className="input-base h-10 text-sm"
									placeholder="응답 입력"
									value={option}
									onChange={(event) => updateOption(index, event.target.value)}
								/>
								<button
									type="button"
									className="btn btn-secondary btn-sm shrink-0 px-3"
									onClick={() => removeOption(index)}
								>
									삭제
								</button>
							</div>
						))}
					</div>
					<button type="button" className="btn btn-secondary btn-sm w-full" onClick={addOption}>
						+ 다른 응답 추가
					</button>
				</div>

				<div className="space-y-1.5">
					<label className="text-xs font-semibold text-text-secondary">지속 시간</label>
					<select
						className="input-base h-10 text-sm"
						value={duration}
						onChange={(event) => setDuration(Number(event.target.value))}
					>
						<option value={0.05}>3분</option>
						<option value={1}>1시간</option>
						<option value={4}>4시간</option>
						<option value={8}>8시간</option>
						<option value={24}>24시간</option>
						<option value={72}>3일</option>
					</select>
				</div>

				<label className="inline-flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
					<input type="checkbox" checked={allowMulti} onChange={() => setAllowMulti((prev) => !prev)} />
					중복 응답 허용
				</label>
			</div>
		</Modal>
	);
}
