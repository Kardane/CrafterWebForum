'use client';

import { useState } from 'react';
import { MoreVertical, Edit, Trash2, Copy } from 'lucide-react';

interface CommentActionsProps {
	onEdit: () => void;
	onDelete: () => void;
	onCopy: () => void;
	disabled?: boolean;
}

export default function CommentActions({ onEdit, onDelete, onCopy, disabled = false }: CommentActionsProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<div className="relative">
			<button
				onClick={() => setIsOpen(!isOpen)}
				disabled={disabled}
				className="p-1 hover:bg-bg-tertiary rounded transition-colors"
			>
				<MoreVertical className="w-5 h-5" />
			</button>

			{isOpen && (
				<>
					{/* 배경 클릭 시 닫기 */}
					<div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

					{/* 드롭다운 메뉴 */}
					<div className="absolute right-0 top-8 z-20 bg-bg-tertiary border border-border rounded-lg shadow-lg min-w-[120px] py-1">
						<button
							onClick={() => {
								onEdit();
								setIsOpen(false);
							}}
							disabled={disabled}
							className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-bg-secondary transition-colors"
						>
							<Edit className="w-4 h-4" />
							수정
						</button>
						<button
							onClick={() => {
								onCopy();
								setIsOpen(false);
							}}
							disabled={disabled}
							className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-bg-secondary transition-colors"
						>
							<Copy className="w-4 h-4" />
							복사
						</button>
						<button
							onClick={() => {
								onDelete();
								setIsOpen(false);
							}}
							disabled={disabled}
							className="w-full flex items-center gap-2 px-4 py-2 text-sm text-error hover:bg-bg-secondary transition-colors"
						>
							<Trash2 className="w-4 h-4" />
							삭제
						</button>
					</div>
				</>
			)}
		</div>
	);
}
