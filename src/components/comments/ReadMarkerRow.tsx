/**
 * 읽음 마커 행 컴포넌트
 * "여기부터 새 댓글" 구분선 표시
 */

interface ReadMarkerRowProps {
	rowKey?: string;
}

export default function ReadMarkerRow({ rowKey }: ReadMarkerRowProps) {
	return (
		<div key={rowKey} className="read-marker">
			<span className="divider-line" aria-hidden="true" />
			<span className="divider-label">여기부터 새 댓글</span>
			<span className="divider-line" aria-hidden="true" />
		</div>
	);
}
