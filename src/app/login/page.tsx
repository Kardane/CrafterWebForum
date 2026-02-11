"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * 로그인 페이지 - 레거시 스타일
 * - 배경 이미지 (background.png)
 * - 좌측 정렬 블러 카드
 * - 필드별 인라인 에러
 */
export default function LoginPage() {
	const router = useRouter();
	const [nickname, setNickname] = useState("");
	const [password, setPassword] = useState("");
	const [nicknameError, setNicknameError] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// 에러 초기화
		setNicknameError("");
		setPasswordError("");

		if (!nickname) {
			setNicknameError("닉네임을 입력해주세요");
			return;
		}
		if (!password) {
			setPasswordError("비밀번호를 입력해주세요");
			return;
		}

		setIsLoading(true);

		try {
			const result = await signIn("credentials", {
				nickname,
				password,
				redirect: false
			});

			if (result?.error) {
				// 에러 메시지에 따라 분기
				const msg = result.error;
				if (msg.includes("닉네임") || msg.includes("사용자")) {
					setNicknameError(msg);
				} else if (msg.includes("비밀번호")) {
					setPasswordError(msg);
				} else {
					setPasswordError(msg || "로그인에 실패했습니다");
				}
			} else {
				// 로그인 성공
				router.push("/");
				router.refresh();
			}
		} catch (error) {
			setPasswordError("로그인 중 오류가 발생했습니다");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="auth-container">
			<div className="auth-card">
				{/* 헤더 */}
				<div className="auth-header">
					<img
						src="/img/Crafter.png"
						alt="Logo"
						className="auth-logo"
					/>
					<h1 className="auth-title">스티브 갤러리 개발 포럼</h1>
					<p className="auth-subtitle">계정에 로그인하세요</p>
				</div>

				{/* 폼 */}
				<form onSubmit={handleSubmit} className="auth-form">
					{/* 닉네임 필드 */}
					<div className="form-group">
						<label className="form-label" htmlFor="nickname">
							닉네임
						</label>
						<input
							type="text"
							id="nickname"
							className="form-input"
							placeholder="닉네임을 입력하세요"
							value={nickname}
							onChange={(e) => setNickname(e.target.value)}
							disabled={isLoading}
						/>
						{nicknameError && (
							<div className="auth-error">{nicknameError}</div>
						)}
					</div>

					{/* 비밀번호 필드 */}
					<div className="form-group">
						<label className="form-label" htmlFor="password">
							비밀번호
						</label>
						<input
							type="password"
							id="password"
							className="form-input"
							placeholder="비밀번호를 입력하세요"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							disabled={isLoading}
						/>
						{passwordError && (
							<div className="auth-error">{passwordError}</div>
						)}
					</div>

					{/* 로그인 버튼 */}
					<button
						type="submit"
						className="btn btn-primary btn-block"
						disabled={isLoading}
					>
						{isLoading ? "로그인 중..." : "로그인"}
					</button>
				</form>

				{/* 푸터 */}
				<div className="auth-footer">
					<p>
						계정이 없으신가요?{" "}
						<Link href="/register" style={{ color: '#ff4444' }}>회원가입</Link>
					</p>
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
					border-radius: 0;
					background: transparent;
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

				.auth-form {
					display: flex;
					flex-direction: column;
					gap: 16px;
				}

				.form-group {
					display: flex;
					flex-direction: column;
					gap: 6px;
				}

				.form-label {
					font-size: 0.9rem;
					font-weight: 500;
					color: var(--text-secondary);
				}

				.auth-form .form-input {
					width: 100%;
					padding: 10px 12px;
					background: rgba(0, 0, 0, 0.3) !important;
					border: 1px solid var(--border);
					border-radius: 4px;
					color: var(--text-primary);
					font-size: 0.95rem;
					transition: border-color 0.2s;
				}

				.form-input:focus {
					outline: none;
					border-color: var(--accent);
				}

				.form-input:disabled {
					opacity: 0.6;
					cursor: not-allowed;
				}

				.auth-error {
					color: #ff4444;
					font-size: 0.85rem;
					font-weight: 500;
				}

				.btn-block {
					width: 100%;
					padding: 12px;
					font-size: 1rem;
				}

				.auth-footer {
					margin-top: 20px;
					text-align: center;
					font-size: 0.9rem;
					color: var(--text-muted);
				}

				.auth-footer a {
					color: #ff4444 !important;
					text-decoration: none;
				}

				.auth-footer a:hover {
					text-decoration: underline;
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
