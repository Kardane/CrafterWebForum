"use client";

import { useEffect, useState } from "react";
import ProfileCard from "@/components/profile/ProfileCard";
import UserStats from "@/components/profile/UserStats";
import PasswordChangeForm from "@/components/profile/PasswordChangeForm";
import { useRouter } from "next/navigation";

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

	useEffect(() => {
		async function fetchData() {
			try {
				const res = await fetch("/api/users/me", {
					headers: {
						"Cache-Control": "no-store",
					},
				});

				if (res.status === 401) {
					router.push("/api/auth/signin");
					return;
				}

				if (!res.ok) {
					throw new Error("Failed to load profile");
				}

				const data: ProfileResponse = await res.json();
				setUserData(data.user);
				setStats(data.stats);
			} catch (err) {
				console.error("Profile fetch error:", err);
				setError("프로필 정보를 불러오는데 실패했습니다.");
			} finally {
				setIsLoading(false);
			}
		}

		fetchData();
	}, [router]);

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
				<button onClick={() => window.location.reload()} className="btn btn-secondary">
					다시 시도
				</button>
			</div>
		);
	}

	return (
		<div className="max-w-2xl mx-auto p-6 space-y-6">
			<header className="mb-6">
				<h1 className="text-2xl font-bold flex items-center gap-2">
					<span>👤</span> 내 정보
				</h1>
			</header>

			<ProfileCard user={userData} />
			<UserStats stats={stats} />
			<PasswordChangeForm />
		</div>
	);
}
