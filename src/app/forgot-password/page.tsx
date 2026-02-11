"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { text } from "@/lib/system-text";

interface CodeCheckResponse {
	verified: boolean;
	nickname: string | null;
}

interface PasswordResetResponse {
	success?: boolean;
	message?: string;
	error?: string;
}

export default function ForgotPasswordPage() {
	const router = useRouter();
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const pollRef = useRef<NodeJS.Timeout | null>(null);
	const [step, setStep] = useState<"auth" | "reset">("auth");
	const [authCode, setAuthCode] = useState("");
	const [timeRemaining, setTimeRemaining] = useState(60);
	const [isPolling, setIsPolling] = useState(false);
	const [verifiedNickname, setVerifiedNickname] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [formError, setFormError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const stopPolling = () => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
		}
		if (pollRef.current) {
			clearInterval(pollRef.current);
		}
		setIsPolling(false);
	};

	const startTimer = () => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
		}

		timerRef.current = setInterval(() => {
			setTimeRemaining((prev) => {
				if (prev <= 1) {
					void generateCode();
					return 60;
				}
				return prev - 1;
			});
		}, 1000);
	};

	const startPolling = (code: string) => {
		if (pollRef.current) {
			clearInterval(pollRef.current);
		}
		setIsPolling(true);

		pollRef.current = setInterval(async () => {
			try {
				const response = await fetch(`/api/minecraft/check/${code}`);
				if (!response.ok) {
					return;
				}
				const payload = (await response.json()) as CodeCheckResponse;
				if (!payload.verified || !payload.nickname) {
					return;
				}
				stopPolling();
				setVerifiedNickname(payload.nickname);
				setStep("reset");
			} catch (error) {
				console.error("Forgot password polling error:", error);
			}
		}, 2000);
	};

	const generateCode = async () => {
		setFormError("");
		try {
			const response = await fetch("/api/minecraft/code", { method: "POST" });
			const payload = (await response.json()) as { code?: string; error?: string };
			if (!response.ok || !payload.code) {
				throw new Error(payload.error || "code_generation_failed");
			}
			setAuthCode(payload.code);
			setTimeRemaining(60);
			startTimer();
			startPolling(payload.code);
		} catch (error) {
			console.error("Forgot password code generation error:", error);
			setFormError(text("passwordReset.errorGenerateCode"));
		}
	};

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setFormError("");

		if (newPassword !== confirmPassword) {
			setFormError(text("passwordReset.errorPasswordMismatch"));
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await fetch("/api/auth/password/forgot", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					code: authCode,
					newPassword,
				}),
			});
			const payload = (await response.json()) as PasswordResetResponse;
			if (!response.ok || !payload.success) {
				throw new Error(payload.message || text("passwordReset.errorResetFailed"));
			}
			alert(payload.message || text("passwordReset.successMessage"));
			router.push("/login");
		} catch (error) {
			console.error("Forgot password reset error:", error);
			setFormError(
				error instanceof Error ? error.message : text("passwordReset.errorUnexpected")
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	useEffect(
		() => () => {
			stopPolling();
		},
		[]
	);

	return (
		<div className="auth-container">
			<div className="auth-card">
				<div className="auth-header">
					<img src="/img/Crafter.png" alt="Logo" className="auth-logo" />
					<h1 className="auth-title">{text("passwordReset.title")}</h1>
					<p className="auth-subtitle">
						{step === "auth"
							? text("passwordReset.subtitleAuth")
							: text("passwordReset.subtitleForm")}
					</p>
				</div>

				{step === "auth" && (
					<div className="auth-step">
						{!authCode ? (
							<button type="button" onClick={() => void generateCode()} className="btn btn-primary btn-block">
								{text("passwordReset.startAuthButton")}
							</button>
						) : (
							<>
								<div className="code-display">
									<div className="code-box">
										<span className="code-text">{authCode}</span>
									</div>
									<p className="code-instruction">
										{text("passwordReset.codeInstruction")}
										<br />
										<code className="code-command">/forum auth {authCode}</code>
									</p>
									<p className="code-timer">
										{text("passwordReset.codeRefreshIn", { seconds: timeRemaining })}
									</p>
								</div>
								{isPolling && (
									<div className="loading-spinner">
										<div className="spinner" />
										{text("passwordReset.waitingAuth")}
									</div>
								)}
							</>
						)}
					</div>
				)}

				{step === "reset" && (
					<form onSubmit={handleSubmit} className="auth-form">
						<div className="form-group">
							<label className="form-label" htmlFor="nickname">
								{text("passwordReset.verifiedNicknameLabel")}
							</label>
							<input
								id="nickname"
								type="text"
								className="form-input form-input-readonly"
								value={verifiedNickname}
								readOnly
							/>
						</div>

						<div className="form-group">
							<label className="form-label" htmlFor="newPassword">
								{text("passwordReset.newPasswordLabel")}
							</label>
							<input
								id="newPassword"
								type="password"
								className="form-input"
								placeholder={text("passwordReset.newPasswordPlaceholder")}
								value={newPassword}
								onChange={(event) => setNewPassword(event.target.value)}
								disabled={isSubmitting}
								required
							/>
						</div>

						<div className="form-group">
							<label className="form-label" htmlFor="confirmPassword">
								{text("passwordReset.confirmPasswordLabel")}
							</label>
							<input
								id="confirmPassword"
								type="password"
								className="form-input"
								placeholder={text("passwordReset.confirmPasswordPlaceholder")}
								value={confirmPassword}
								onChange={(event) => setConfirmPassword(event.target.value)}
								disabled={isSubmitting}
								required
							/>
						</div>

						{formError && <div className="auth-error">{formError}</div>}

						<button type="submit" className="btn btn-primary btn-block" disabled={isSubmitting}>
							{isSubmitting
								? text("passwordReset.submittingButton")
								: text("passwordReset.submitButton")}
						</button>
					</form>
				)}

				<div className="auth-footer">
					<Link href="/login">{text("auth.backToLogin")}</Link>
				</div>
			</div>

			<style jsx>{`
				.auth-container {
					min-height: 100vh;
					min-height: 100dvh;
					display: flex;
					align-items: center;
					justify-content: center;
					padding: 20px;
					padding-bottom: max(20px, env(safe-area-inset-bottom));
					background: url("/img/background.png") center/cover no-repeat;
					background-attachment: scroll;
				}

				.auth-card {
					background: rgba(30, 32, 36, 0.82);
					border-radius: 12px;
					padding: 32px;
					width: 100%;
					max-width: 440px;
					box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
					backdrop-filter: blur(10px);
				}

				.auth-header {
					text-align: center;
					margin-bottom: 20px;
				}

				.auth-logo {
					width: 72px;
					height: 72px;
					margin: 0 auto 16px;
					display: block;
					image-rendering: pixelated;
				}

				.auth-title {
					font-size: 1.45rem;
					font-weight: 700;
					margin-bottom: 6px;
					color: var(--color-text-primary);
				}

				.auth-subtitle {
					color: var(--color-text-secondary);
					font-size: 0.9rem;
				}

				.auth-form {
					display: flex;
					flex-direction: column;
					gap: 14px;
				}

				.form-group {
					display: flex;
					flex-direction: column;
					gap: 6px;
				}

				.form-label {
					font-size: 0.9rem;
					font-weight: 500;
					color: var(--color-text-secondary);
				}

				.form-input {
					width: 100%;
					padding: 10px 12px;
					background: rgba(0, 0, 0, 0.32);
					border: 1px solid var(--color-border);
					border-radius: 4px;
					color: var(--color-text-primary);
					font-size: 0.95rem;
				}

				.form-input:focus {
					outline: none;
					border-color: var(--color-accent);
				}

				.form-input-readonly {
					opacity: 0.78;
					cursor: default;
				}

				.auth-error {
					color: var(--color-error);
					font-size: 0.85rem;
					font-weight: 600;
				}

				.code-display {
					border: 1px solid var(--color-border);
					border-radius: 8px;
					padding: 16px;
					background: rgba(0, 0, 0, 0.25);
				}

				.code-box {
					border-radius: 8px;
					border: 1px solid var(--color-border);
					padding: 10px 12px;
					text-align: center;
					background: rgba(0, 0, 0, 0.3);
					margin-bottom: 10px;
				}

				.code-text {
					font-family: "JetBrains Mono", monospace;
					letter-spacing: 0.14em;
					font-size: 1rem;
					font-weight: 700;
					color: var(--color-text-primary);
				}

				.code-instruction {
					color: var(--color-text-secondary);
					font-size: 0.85rem;
					line-height: 1.45;
				}

				.code-command {
					display: inline-block;
					margin-top: 4px;
					padding: 2px 6px;
					background: rgba(0, 0, 0, 0.35);
					border-radius: 4px;
					color: #fff;
				}

				.code-timer {
					margin-top: 8px;
					color: var(--color-text-muted);
					font-size: 0.8rem;
				}

				.loading-spinner {
					display: inline-flex;
					align-items: center;
					gap: 8px;
					margin-top: 12px;
					color: var(--color-text-secondary);
					font-size: 0.9rem;
				}

				.spinner {
					width: 16px;
					height: 16px;
					border: 2px solid var(--color-border);
					border-top-color: var(--color-accent);
					border-radius: 999px;
					animation: spin 1s linear infinite;
				}

				.btn-block {
					width: 100%;
					padding: 11px;
					font-size: 0.96rem;
				}

				.auth-footer {
					margin-top: 16px;
					text-align: center;
					font-size: 0.9rem;
				}

				.auth-footer a {
					color: var(--color-accent);
					text-decoration: none;
				}

				.auth-footer a:hover {
					text-decoration: underline;
				}

				@keyframes spin {
					from {
						transform: rotate(0deg);
					}
					to {
						transform: rotate(360deg);
					}
				}
			`}</style>
		</div>
	);
}
