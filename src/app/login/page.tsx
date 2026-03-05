"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import classNames from "classnames";
import AuthShell from "@/components/auth/AuthShell";
import styles from "@/components/auth/AuthShell.module.css";
import { text } from "@/lib/system-text";

const LOGIN_BACKGROUND_IMAGE_URL =
	"https://i.namu.wiki/i/JSCXlcOdyQNZFb_D6XncRSZWuQMpBbl2UoJm97nhmtHdKsAQcm0JTgTNg3e9EP9jJ-V8wUsXkzkAV52tnzZ65jvbK6cJ4n79EeYTleOsaqfdQVBg8uYwHWvV2Pfa0ARGeJDaA-cNHSRAZXkhmZKfmQ.webp";

export default function LoginPage() {
	const router = useRouter();
	const [nickname, setNickname] = useState("");
	const [password, setPassword] = useState("");
	const [nicknameError, setNicknameError] = useState("");
	const [passwordError, setPasswordError] = useState("");
	const [isLoading, setIsLoading] = useState(false);

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		setNicknameError("");
		setPasswordError("");

		if (!nickname) {
			setNicknameError(text("auth.errorNicknameRequired"));
			return;
		}
		if (!password) {
			setPasswordError(text("auth.errorPasswordRequired"));
			return;
		}

		setIsLoading(true);
		try {
			const result = await signIn("credentials", {
				nickname,
				password,
				redirect: false,
			});

			if (result?.error) {
				const message = result.error;
				if (message.includes("닉네임") || message.includes("사용자")) {
					setNicknameError(message);
					return;
				}
				if (message.includes("비밀번호")) {
					setPasswordError(message);
					return;
				}
				setPasswordError(message || text("auth.errorLoginFailed"));
				return;
			}

			router.push("/");
			router.refresh();
		} catch {
			setPasswordError(text("auth.errorLoginUnexpected"));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<AuthShell
			title={text("auth.title")}
			subtitle={text("auth.subtitle")}
			align="left"
			backgroundImageUrl={LOGIN_BACKGROUND_IMAGE_URL}
			footer={
				<>
					<p>
						{text("auth.noAccount")} <Link href="/register">{text("auth.registerLink")}</Link>
					</p>
					<p className="mt-2">
						<Link href="/forgot-password">{text("auth.forgotPasswordLink")}</Link>
					</p>
				</>
			}
		>
			<form onSubmit={handleSubmit} className={styles.form}>
				<div className={styles.formGroup}>
					<label className={styles.formLabel} htmlFor="nickname">
						{text("auth.nicknameLabel")}
					</label>
					<input
						type="text"
						id="nickname"
						className={styles.formInput}
						placeholder={text("auth.nicknamePlaceholder")}
						autoComplete="username"
						spellCheck={false}
						value={nickname}
						onChange={(event) => setNickname(event.target.value)}
						disabled={isLoading}
					/>
					{nicknameError && <div className={styles.formError}>{nicknameError}</div>}
				</div>

				<div className={styles.formGroup}>
					<label className={styles.formLabel} htmlFor="password">
						{text("auth.passwordLabel")}
					</label>
					<input
						type="password"
						id="password"
						className={styles.formInput}
						placeholder={text("auth.passwordPlaceholder")}
						autoComplete="current-password"
						value={password}
						onChange={(event) => setPassword(event.target.value)}
						disabled={isLoading}
					/>
					{passwordError && <div className={styles.formError}>{passwordError}</div>}
				</div>

				<button
					type="submit"
					className={classNames("btn btn-primary", styles.fullWidthButton)}
					disabled={isLoading}
				>
					{isLoading ? text("auth.loggingInButton") : text("auth.loginButton")}
				</button>
			</form>
		</AuthShell>
	);
}
