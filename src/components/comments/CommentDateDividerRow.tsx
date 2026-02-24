/**
 * 날짜 구분선 행 컴포넌트
 */

interface CommentDateDividerRowProps {
	label: string;
}

export default function CommentDateDividerRow({ label }: CommentDateDividerRowProps) {
	return (
		<div
			className="date-divider"
			aria-label={`댓글 날짜 구분선 ${label}`}
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				width: "100%",
				gap: "10px",
				margin: "16px 0 12px",
			}}
		>
			<span
				className="divider-line"
				aria-hidden="true"
				style={{
					display: "block",
					height: "1px",
					flex: 1,
					minWidth: "24px",
					background: "transparent",
					borderTop: "1px solid rgba(255,255,255,0.16)",
					opacity: 1,
				}}
			/>
			<span
				className="divider-label"
				style={{
					fontSize: "8px",
					fontWeight: 500,
					color: "var(--text-muted)",
					opacity: 0.5,
					lineHeight: 1,
					padding: "0 4px",
					whiteSpace: "nowrap",
					textAlign: "center",
				}}
			>
				{label}
			</span>
			<span
				className="divider-line"
				aria-hidden="true"
				style={{
					display: "block",
					height: "1px",
					flex: 1,
					minWidth: "24px",
					background: "transparent",
					borderTop: "1px solid rgba(255,255,255,0.16)",
					opacity: 1,
				}}
			/>
		</div>
	);
}
