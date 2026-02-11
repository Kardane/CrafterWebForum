"use client";

import Link from "next/link";

/**
 * 승인 대기 페이지
 * - 회원가입 후 관리자 승인 대기 상태
 */
export default function PendingPage() {
	return (
		<div className="auth-container">
			<div className="auth-card">
				{/* 헤더 */}
				<div className="auth-header">
					<img src="/img/Crafter.png" alt="Logo" className="auth-logo" />
					<h1 className="auth-title">승인 대기 중</h1>
					<p className="auth-subtitle">
						관리자의 승인을 기다리고 있습니다
					</p>
				</div>

				{/* 안내 메시지 */}
				<div className="pending-content">
					<div className="pending-icon">⏳</div>
					<p className="pending-message">
						회원가입이 완료되었습니다!
						<br />
						관리자가 계정을 검토한 후 승인할 예정입니다.
					</p>
					<p className="pending-note">
						승인 완료 시 정상적으로 로그인할 수 있습니다.
						<br />
						승인 진행 상황은 관리자에게 문의해주세요.
					</p>
				</div>

				{/* 푸터 */}
				<div className="auth-footer">
					<Link href="/login" className="btn btn-secondary btn-block">
						로그인 페이지로 돌아가기
					</Link>
				</div>
			</div>

			{/* 스타일 */}
			<style jsx>{`
				.auth-container {
					min-height: 100vh;
					min-height: 100dvh;
					display: flex;
					align-items: center;
					justify-content: flex-start;
					padding: 20px 20px 20px 10%;
					background: url("/img/background.png") center/cover no-repeat fixed;
				}

				.auth-card {
					background: rgba(30, 32, 36, 0.8);
					border-radius: 12px;
					padding: 40px;
					width: 100%;
					max-width: 400px;
					box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
					backdrop-filter: blur(10px);
				}

				.auth-header {
					text-align: center;
					margin-bottom: 24px;
				}

				.auth-logo {
					width: 80px;
					height: 80px;
					margin: 0 auto 20px;
					display: block;
					image-rendering: pixelated;
				}

				.auth-title {
					font-size: 1.5rem;
					font-weight: 700;
					margin-bottom: 8px;
					color: var(--text-primary);
				}

				.auth-subtitle {
					color: var(--text-muted);
					font-size: 0.9rem;
				}

				.pending-content {
					text-align: center;
					padding: 20px 0;
				}

				.pending-icon {
					font-size: 3rem;
					margin-bottom: 16px;
				}

				.pending-message {
					font-size: 1rem;
					color: var(--text-primary);
					line-height: 1.6;
					margin-bottom: 16px;
				}

				.pending-note {
					font-size: 0.85rem;
					color: var(--text-muted);
					line-height: 1.5;
				}

				.auth-footer {
					margin-top: 20px;
				}

				.btn-block {
					display: block;
					width: 100%;
					padding: 12px;
					text-align: center;
					font-size: 0.95rem;
					text-decoration: none;
				}

				@media (max-width: 768px) {
					.auth-container {
						padding: 20px;
						padding-bottom: max(20px, env(safe-area-inset-bottom));
						justify-content: center;
						background-attachment: scroll;
					}
				}
			`}</style>
		</div>
	);
}
