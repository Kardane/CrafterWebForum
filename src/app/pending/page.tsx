import Link from "next/link";
import classNames from "classnames";
import AuthShell from "@/components/auth/AuthShell";
import styles from "@/components/auth/AuthShell.module.css";

export default function PendingPage() {
	return (
		<AuthShell
			title="승인 대기 중"
			subtitle="관리자의 승인을 기다리고 있습니다"
			align="left"
			footer={
				<Link href="/login" className={classNames("btn btn-secondary", styles.fullWidthButton)}>
					로그인 페이지로 돌아가기
				</Link>
			}
		>
			<div className={styles.pendingContent}>
				<div className={styles.pendingIcon}>⏳</div>
				<p className={styles.pendingMessage}>
					회원가입이 완료되었습니다!
					<br />
					관리자가 계정을 검토한 후 승인할 예정입니다.
				</p>
				<p className={styles.pendingNote}>
					승인 완료 시 정상적으로 로그인할 수 있습니다.
					<br />
					승인 진행 상황은 관리자에게 문의해주세요.
				</p>
			</div>
		</AuthShell>
	);
}
