"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import classNames from "classnames";
import AuthShell from "@/components/auth/AuthShell";
import styles from "@/components/auth/AuthShell.module.css";
import { useMinecraftAuthPolling } from "@/components/auth/useMinecraftAuthPolling";

export default function RegisterPage() {
	const router = useRouter();
	const [step, setStep] = useState<"auth" | "register">("auth");
	const [verifiedNickname, setVerifiedNickname] = useState("");
	const [password, setPassword] = useState("");
	const [passwordConfirm, setPasswordConfirm] = useState("");
	const [signupNote, setSignupNote] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [confirmError, setConfirmError] = useState("");
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
			const payload = (await response.json()) as { code?: string };
			if (!response.ok || !payload.code) {
				throw new Error("code_generation_failed");
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
			const payload = (await response.json()) as {
				verified?: boolean;
				nickname?: string;
			};
			return {
				verified: Boolean(payload.verified),
				nickname: payload.nickname ?? null,
			};
		},
		onVerified: ({ nickname }) => {
			if (!nickname) {
				return;
			}
			setVerifiedNickname(nickname);
			setStep("register");
		},
		refreshOnExpire: true,
		onCodeError: () => {
			alert("코드 발급에 실패했습니다");
		},
	});

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setPasswordError("");
		setConfirmError("");

		if (password !== passwordConfirm) {
			setConfirmError("비밀번호가 일치하지 않습니다");
			return;
		}

		const passwordRegex = /^(?=.*[0-9!@#$%^&*])(?=.{8,})/;
		if (!passwordRegex.test(password)) {
			setPasswordError("비밀번호는 8자 이상이며, 숫자나 특수문자를 포함해야 합니다");
			return;
		}

		setIsSubmitting(true);
		try {
			const response = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					nickname: verifiedNickname,
					password,
					code: authCode,
					signupNote,
				}),
			});
			const payload = (await response.json()) as { message?: string };

			if (!response.ok) {
				setPasswordError(payload.message || "회원가입에 실패했습니다");
				return;
			}

			alert("회원가입이 완료되었습니다! 로그인 페이지로 이동합니다.");
			router.push("/login");
		} catch {
			setPasswordError("회원가입 중 오류가 발생했습니다");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<AuthShell
			title="회원가입"
			subtitle={
				step === "auth" ? "마인크래프트 계정 인증이 필요합니다" : "계정 정보를 입력하세요"
			}
			align="left"
			footer={
				<p>
					이미 계정이 있으신가요? <Link href="/login">로그인</Link>
				</p>
			}
		>
			{step === "auth" && (
				<div className={styles.step}>
					{!authCode ? (
						<button
							type="button"
							onClick={() => void generateCode()}
							className={classNames("btn btn-primary", styles.fullWidthButton)}
							disabled={isAuthLoading}
						>
							{isAuthLoading ? "코드 발급 중..." : "서버 인증 시작"}
						</button>
					) : (
						<>
							<div className={styles.codeDisplay}>
								<div className={styles.codeBox}>
									<span className={styles.codeText}>{authCode}</span>
								</div>
								<p className={styles.codeInstruction}>
									서버에 접속하여 입력하세요:
									<br />
									<code className={styles.codeCommand}>/forum auth {authCode}</code>
								</p>
								<p className={styles.codeTimer}>{timeRemaining}초 후 갱신됨</p>
							</div>

							{isPolling && (
								<div className={styles.spinnerLine}>
									<div className={styles.spinner} />
									인증 대기 중...
								</div>
							)}
						</>
					)}
				</div>
			)}

			{step === "register" && (
				<form onSubmit={handleSubmit} className={styles.form}>
					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="nickname">
							닉네임 (마인크래프트)
						</label>
						<input
							type="text"
							id="nickname"
							className={classNames(styles.formInput, styles.formInputReadonly)}
							value={verifiedNickname}
							readOnly
						/>
					</div>

					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="signupNote">
							개발 활동 내역 (선택)
						</label>
						<textarea
							id="signupNote"
							className={styles.formInput}
							placeholder="스티브 갤러리에서 개발 관련 활동한 이력을 짧게 남겨주세요."
							value={signupNote}
							onChange={(event) => setSignupNote(event.target.value)}
							rows={3}
						/>
					</div>

					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="password">
							비밀번호
						</label>
						<input
							type="password"
							id="password"
							className={styles.formInput}
							placeholder="비밀번호를 입력하세요"
							value={password}
							onChange={(event) => setPassword(event.target.value)}
							disabled={isSubmitting}
						/>
						{passwordError && <div className={styles.formError}>{passwordError}</div>}
					</div>

					<div className={styles.formGroup}>
						<label className={styles.formLabel} htmlFor="passwordConfirm">
							비밀번호 확인
						</label>
						<input
							type="password"
							id="passwordConfirm"
							className={styles.formInput}
							placeholder="비밀번호를 다시 입력하세요"
							value={passwordConfirm}
							onChange={(event) => setPasswordConfirm(event.target.value)}
							disabled={isSubmitting}
						/>
						{confirmError && <div className={styles.formError}>{confirmError}</div>}
					</div>

					<button
						type="submit"
						className={classNames("btn btn-primary", styles.fullWidthButton)}
						disabled={isSubmitting}
					>
						{isSubmitting ? "처리 중..." : "회원가입 완료"}
					</button>
				</form>
			)}
		</AuthShell>
	);
}
