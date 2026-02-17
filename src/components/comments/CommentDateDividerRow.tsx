/**
 * 날짜 구분선 행 컴포넌트
 */

interface CommentDateDividerRowProps {
	label: string;
}

export default function CommentDateDividerRow({ label }: CommentDateDividerRowProps) {
	return (
		<div className="date-divider" aria-label={`댓글 날짜 구분선 ${label}`}>
			<span className="divider-line" aria-hidden="true" />
			<span className="divider-label">{label}</span>
			<span className="divider-line" aria-hidden="true" />
		</div>
	);
}
