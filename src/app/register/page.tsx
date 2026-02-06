"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/**
 * 회원가입 페이지 - 레거시 스타일
 * - 2단계 프로세스: 마인크래프트 인증 → 회원가입 정보 입력
 */
export default function RegisterPage() {
	const router = useRouter();

	// Step 상태
	const [step, setStep] = useState<"auth" | "register">("auth");

	// 인증 코드 관련
	const [authCode, setAuthCode] = useState("");
	const [timeRemaining, setTimeRemaining] = useState(60);
	const [isPolling, setIsPolling] = useState(false);
	const [verifiedNickname, setVerifiedNickname] = useState("");

	// 회원가입 폼
	const [password, setPassword] = useState("");
	const [passwordConfirm, setPasswordConfirm] = useState("");
	const [signupNote, setSignupNote] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [confirmError, setConfirmError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	// 타이머 및 폴링 인터벌 ref
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const pollRef = useRef<NodeJS.Timeout | null>(null);

	// 인증 코드 발급
	const generateCode = async () => {
		try {
			const res = await fetch("/api/minecraft/code", { method: "POST" });
			const data = await res.json();

			if (data.code) {
				setAuthCode(data.code);
				setTimeRemaining(60);
				startTimer();
				startPolling(data.code);
			}
		} catch (error) {
			alert("코드 발급에 실패했습니다");
		}
	};

	// 타이머 시작
	const startTimer = () => {
		if (timerRef.current) clearInterval(timerRef.current);

		timerRef.current = setInterval(() => {
			setTimeRemaining((prev) => {
				if (prev <= 1) {
					// 시간 초과 시 새 코드 발급
					generateCode();
					return 60;
				}
				return prev - 1;
			});
		}, 1000);
	};

	// 폴링 시작
	const startPolling = (code: string) => {
		if (pollRef.current) clearInterval(pollRef.current);
		setIsPolling(true);

		pollRef.current = setInterval(async () => {
			try {
				const res = await fetch(`/api/minecraft/check/${code}`);
				const data = await res.json();

				if (data.verified) {
					// 인증 성공
					stopPolling();
					setVerifiedNickname(data.nickname);
					setStep("register");
				}
			} catch (error) {
				console.error("Polling error", error);
			}
		}, 2000);
	};

	// 폴링 중지
	const stopPolling = () => {
		if (timerRef.current) clearInterval(timerRef.current);
		if (pollRef.current) clearInterval(pollRef.current);
		setIsPolling(false);
	};

	// 컴포넌트 언마운트 시 클린업
	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (pollRef.current) clearInterval(pollRef.current);
		};
	}, []);

	// 회원가입 제출
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// 에러 초기화
		setPasswordError("");
		setConfirmError("");

		if (password !== passwordConfirm) {
			setConfirmError("비밀번호가 일치하지 않습니다");
			return;
		}

		if (password.length < 4) {
			setPasswordError("비밀번호는 최소 4자 이상이어야 합니다");
			return;
		}

		setIsSubmitting(true);

		try {
			const res = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					nickname: verifiedNickname,
					password,
					code: authCode,
					signupNote
				})
			});

			const data = await res.json();

			if (res.ok) {
				alert("회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.");
				router.push("/login");
			} else {
				setPasswordError(data.message || "회원가입에 실패했습니다");
			}
		} catch (error) {
			setPasswordError("회원가입 중 오류가 발생했습니다");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="auth-container">
			<div className="auth-card">
				{/* 헤더 */}
				<div className="auth-header">
					<img src="/img/Crafter.png" alt="Logo" className="auth-logo" />
					<h1 className="auth-title">회원가입</h1>
					<p className="auth-subtitle">
						{step === "auth"
							? "마인크래프트 계정 인증이 필요합니다"
							: "계정 정보를 입력하세요"}
					</p>
				</div>

				{/* Step 1: 마인크래프트 인증 */}
				{step === "auth" && (
					<div className="auth-step">
						{!authCode ? (
							<button
								onClick={generateCode}
								className="btn btn-primary btn-block"
							>
								서버 인증 시작
							</button>
						) : (
							<>
								{/* 인증 코드 표시 */}
								<div className="code-display">
									<div className="code-box">
										<span className="code-text">{authCode}</span>
									</div>
									<p className="code-instruction">
										서버에 접속하여 입력하세요:
										<br />
										<code className="code-command">/forum auth {authCode}</code>
									</p>
									<p className="code-timer">
										{timeRemaining}초 후 갱신됨
									</p>
								</div>

								{/* 로딩 스피너 */}
								<div className="loading-spinner">
									<div className="spinner"></div>
									인증 대기 중...
								</div>
							</>
						)}
					</div>
				)}

				{/* Step 2: 회원가입 폼 */}
				{step === "register" && (
					<form onSubmit={handleSubmit} className="auth-form">
						{/* 닉네임 (readonly) */}
						<div className="form-group">
							<label className="form-label" htmlFor="nickname">
								닉네임 (마인크래프트)
							</label>
							<input
								type="text"
								id="nickname"
								className="form-input form-input-readonly"
								value={verifiedNickname}
								readOnly
							/>
						</div>

						{/* 개발 활동 내역 */}
						<div className="form-group">
							<label className="form-label" htmlFor="signupNote">
								개발 활동 내역 (선택)
							</label>
							<textarea
								id="signupNote"
								className="form-input"
								placeholder="스티브 갤러리에서 개발 관련 활동한 이력을 짧게 남겨주세요."
								value={signupNote}
								onChange={(e) => setSignupNote(e.target.value)}
								rows={3}
							/>
						</div>

						{/* 비밀번호 */}
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
								disabled={isSubmitting}
							/>
							{passwordError && (
								<div className="auth-error">{passwordError}</div>
							)}
						</div>

						{/* 비밀번호 확인 */}
						<div className="form-group">
							<label className="form-label" htmlFor="passwordConfirm">
								비밀번호 확인
							</label>
							<input
								type="password"
								id="passwordConfirm"
								className="form-input"
								placeholder="비밀번호를 다시 입력하세요"
								value={passwordConfirm}
								onChange={(e) => setPasswordConfirm(e.target.value)}
								disabled={isSubmitting}
							/>
							{confirmError && (
								<div className="auth-error">{confirmError}</div>
							)}
						</div>

						{/* 제출 버튼 */}
						<button
							type="submit"
							className="btn btn-primary btn-block"
							disabled={isSubmitting}
						>
							{isSubmitting ? "처리 중..." : "회원가입 완료"}
						</button>
					</form>
				)}

				{/* 푸터 */}
				<div className="auth-footer">
					<p>
						이미 계정이 있으신가요?{" "}
						<Link href="/login">로그인</Link>
					</p>
				</div>
			</div>

			{/* 스타일 */}
			<style jsx>{`
				.auth-container {
					min-height: 100vh;
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

				.auth-step {
					text-align: center;
				}

				.code-display {
					margin-bottom: 20px;
				}

				.code-box {
					background: rgba(0, 0, 0, 0.5);
					padding: 15px;
					border-radius: 8px;
					display: inline-block;
					min-width: 200px;
					border: 1px solid var(--border);
				}

				.code-text {
					font-family: monospace;
					font-size: 2rem;
					color: #ffaa00;
					letter-spacing: 4px;
					font-weight: 700;
				}

				.code-instruction {
					margin-top: 15px;
					font-size: 0.9rem;
					color: var(--text-secondary);
				}

				.code-command {
					background: rgba(255, 255, 255, 0.1);
					padding: 4px 8px;
					border-radius: 4px;
					margin-top: 5px;
					display: inline-block;
				}

				.code-timer {
					color: var(--accent);
					font-weight: 600;
					margin-top: 10px;
					font-size: 0.85rem;
				}

				.loading-spinner {
					color: var(--text-muted);
					margin-top: 15px;
					font-size: 0.9rem;
				}

				.spinner {
					width: 20px;
					height: 20px;
					border: 2px solid var(--border);
					border-top-color: var(--accent);
					border-radius: 50%;
					animation: spin 1s linear infinite;
					margin: 0 auto 8px;
				}

				@keyframes spin {
					to {
						transform: rotate(360deg);
					}
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

				.form-input {
					width: 100%;
					padding: 10px 12px;
					background: var(--bg-tertiary);
					border: 1px solid var(--border);
					border-radius: 4px;
					color: var(--text-primary);
					font-size: 0.95rem;
					transition: border-color 0.2s;
					resize: vertical;
				}

				.form-input:focus {
					outline: none;
					border-color: var(--accent);
				}

				.form-input-readonly {
					background: rgba(0, 0, 0, 0.3);
					color: var(--text-muted);
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
					color: var(--accent);
					text-decoration: none;
				}

				.auth-footer a:hover {
					text-decoration: underline;
				}

				@media (max-width: 768px) {
					.auth-container {
						padding: 20px;
						justify-content: center;
					}
				}
			`}</style>
		</div>
	);
}
