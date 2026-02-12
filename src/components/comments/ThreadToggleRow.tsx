"use client";

/**
 * 스레드 접기/펼치기 토글 행 컴포넌트
 */

import { ChevronDown } from "lucide-react";

interface ThreadToggleRowProps {
	rowKey: string;
	rootId: number;
	replyCount: number;
	isCollapsed: boolean;
	onToggle: (rootId: number) => void;
}

export default function ThreadToggleRow({
	rowKey,
	rootId,
	replyCount,
	isCollapsed,
	onToggle,
}: ThreadToggleRowProps) {
	return (
		<div key={rowKey} className="thread-toggle-row">
			<button
				type="button"
				className="thread-toggle-btn"
				onClick={() => onToggle(rootId)}
			>
				<ChevronDown size={14} className={isCollapsed ? "" : "expanded"} />
				{isCollapsed
					? `답글 ${replyCount}개 펼치기`
					: `답글 ${replyCount}개 접기`}
			</button>
		</div>
	);
}
