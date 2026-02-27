"use client";

import { useEffect, useState } from "react";
import ProfileCard from "@/components/profile/ProfileCard";
import UserStats from "@/components/profile/UserStats";
import PasswordChangeForm from "@/components/profile/PasswordChangeForm";
import PushSubscriptionPanel from "@/components/profile/PushSubscriptionPanel";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ProfileUser {
	nickname: string;
	minecraftUuid: string | null;
	role: string;
	createdAt: string;
	lastAuthAt: string | null;
}

interface ProfileStats {
	posts: number;
	comments: number;
	likesReceived: number;
}

interface ProfileResponse {
	user: ProfileUser;
	stats: ProfileStats;
}

export default function ProfilePage() {
	const router = useRouter();
	const [userData, setUserData] = useState<ProfileUser | null>(null);
	const [stats, setStats] = useState<ProfileStats | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [retryTick, setRetryTick] = useState(0);

	useEffect(() => {
		const controller = new AbortController();
		let isDisposed = false;

		async function fetchData() {
			setIsLoading(true);
			setError(null);
			try {
				const res = await fetch("/api/users/me", {
					headers: {
						"Cache-Control": "no-store",
					},
					signal: controller.signal,
				});

				if (res.status === 401) {
					router.push("/api/auth/signin");
					return;
				}

				if (!res.ok) {
					throw new Error("Failed to load profile");
				}

				const data: ProfileResponse = await res.json();
				if (isDisposed) {
					return;
				}
				setUserData(data.user);
				setStats(data.stats);
			} catch (err) {
				if (err instanceof Error && err.name === "AbortError") {
					return;
				}
				if (isDisposed) {
					return;
				}
				console.error("Profile fetch error:", err);
				setUserData(null);
				setStats(null);
				setError("프로필 정보를 불러오는데 실패했습니다.");
			} finally {
				if (!isDisposed) {
					setIsLoading(false);
				}
			}
		}

		void fetchData();
		return () => {
			isDisposed = true;
			controller.abort();
		};
	}, [retryTick, router]);

	if (isLoading) {
		return (
			<div className="max-w-2xl mx-auto p-6 flex justify-center py-20">
				<div className="text-text-secondary">로딩 중...</div>
			</div>
		);
	}

	if (error || !userData || !stats) {
		return (
			<div className="max-w-2xl mx-auto p-6 text-center py-20">
				<div className="text-error mb-4">{error || "사용자 정보를 찾을 수 없습니다."}</div>
				<button type="button" onClick={() => setRetryTick((prev) => prev + 1)} className="btn btn-secondary">
					다시 시도
				</button>
			</div>
		);
	}

	return (
		<div className="max-w-2xl mx-auto p-6 space-y-6">
			<header className="mb-6">
				<div className="flex items-center gap-2">
					<Link href="/" className="btn btn-secondary btn-sm">
						← 메인
					</Link>
					<h1 className="flex items-center gap-2 text-2xl font-bold">
						<span>👤</span> 내 정보
					</h1>
				</div>
			</header>

			<ProfileCard user={userData} />
			<UserStats stats={stats} />
			<PushSubscriptionPanel />
			<PasswordChangeForm />
		</div>
	);
}
