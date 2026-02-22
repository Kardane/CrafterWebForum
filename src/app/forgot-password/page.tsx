"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import classNames from "classnames";
import AuthShell from "@/components/auth/AuthShell";
import styles from "@/components/auth/AuthShell.module.css";
import { text } from "@/lib/system-text";
import { useMinecraftAuthPolling } from "@/components/auth/useMinecraftAuthPolling";

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
	const [step, setStep] = useState<"auth" | "reset">("auth");
	const [verifiedNickname, setVerifiedNickname] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [formError, setFormError] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	const {
		code: authCode,
		timeRemaining,
		isPolling,
		isLoading: isAuthLoading,
		start: generateCode,
	} = useMinecraftAuthPolling({
		createCode: async (signal) => {
			const response = await fetch("/api/minecraft/code", {
				method: "POST",
				signal,
			});
			const payload = (await response.json()) as { code?: string; error?: string };
			if (!response.ok || !payload.code) {
				throw new Error(payload.error || "code_generation_failed");
			}
			return {
				code: payload.code,
				expiresIn: 60,
			};
		},
		pollVerification: async ({ code, signal }) => {
			const response = await fetch(`/api/minecraft/check/${code}`, { signal });
			if (!response.ok) {
				return { verified: false };
			}
			const payload = (await response.json()) as CodeCheckResponse;
			return {
				verified: Boolean(payload.verified),
				nickname: payload.nickname,
			};
		},
		onVerified: ({ nickname }) => {
			if (!nickname) {
				return;
			}
			setVerifiedNickname(nickname);
			setStep("reset");
		},
		refreshOnExpire: true,
		onCodeError: (error) => {
			console.error("Forgot password code generation error:", error);
			setFormError(text("passwordReset.errorGenerateCode"));
		},
		onPollError: (error) => {
			console.error("Forgot password polling error:", error);
		},
	});

	const handleGenerateCode = async () => {
		setFormError("");
		await generateCode();
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

	return (
		<AuthShell
			title={text("passwordReset.title")}
			subtitle={
				step === "auth"
					? text("passwordReset.subtitleAuth")
					: text("passwordReset.subtitleForm")
			}
			align="center"
			logoSize={72}
			footer={<Link href="/login">{text("auth.backToLogin")}</Link>}
		>
			{step === "auth" && (
				<div className={styles.step}>
					{!authCode ? (
						<button
							type="button"
							onClick={() => void handleGenerateCode()}
							className={classNames("btn btn-primary", styles.fullWidthButton)}
							disabled={isAuthLoading}
						>
							{isAuthLoading ? "코드 발급 중..." : text("passwordReset.startAuthButton")}
						</button>
					) : (
						<>
							<div className={styles.codeDisplay}>
								<div className={styles.codeBox}>
									<span className={styles.codeText}>{authCode}</span>
								</div>
								<p className={styles.codeInstruction}>
									{text("passwordReset.codeInstruction")}
									<br />
									<code className={styles.codeCommand}>/forum auth {authCode}</code>
								</p>
								<p className={styles.codeTimer}>
									{text("passwordReset.codeRefreshIn", { seconds: timeRemaining })}
								</p>
							</div>

							{isPolling && (
								<div className={styles.spinnerLine}>
									<div className={styles.spinner} />
									{text("passwordReset.waitingAuth")}
								</div>
							)}
						</>
					)}
				</div>
			)}

			{step === "reset" && (
				<form onSubmit={handleSubmit} className={styles.form}>
					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="nickname">
							{text("passwordReset.verifiedNicknameLabel")}
						</label>
						<input
							id="nickname"
							type="text"
							className={classNames(styles.formInput, styles.formInputReadonly)}
							value={verifiedNickname}
							readOnly
						/>
					</div>

					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="newPassword">
							{text("passwordReset.newPasswordLabel")}
						</label>
						<input
							id="newPassword"
							type="password"
							className={styles.formInput}
							placeholder={text("passwordReset.newPasswordPlaceholder")}
							value={newPassword}
							onChange={(event) => setNewPassword(event.target.value)}
							disabled={isSubmitting}
							required
						/>
					</div>

					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="confirmPassword">
							{text("passwordReset.confirmPasswordLabel")}
						</label>
						<input
							id="confirmPassword"
							type="password"
							className={styles.formInput}
							placeholder={text("passwordReset.confirmPasswordPlaceholder")}
							value={confirmPassword}
							onChange={(event) => setConfirmPassword(event.target.value)}
							disabled={isSubmitting}
							required
						/>
					</div>

					{formError && <div className={styles.formError}>{formError}</div>}

					<button
						type="submit"
						className={classNames("btn btn-primary", styles.fullWidthButton)}
						disabled={isSubmitting}
					>
						{isSubmitting
							? text("passwordReset.submittingButton")
							: text("passwordReset.submitButton")}
					</button>
				</form>
			)}
		</AuthShell>
	);
}
