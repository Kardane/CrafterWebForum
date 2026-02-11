'use client';

import { useMemo, useState } from 'react';
import MinecraftReauth from './MinecraftReauth';
import { buildAvatarCandidates } from '@/lib/avatar';

interface ProfileCardProps {
	user: {
		nickname: string;
		minecraftUuid: string | null;
		role: string;
		createdAt: string;
		lastAuthAt: string | null;
	};
}

export default function ProfileCard({ user }: ProfileCardProps) {
	const [isReauthModalOpen, setIsReauthModalOpen] = useState(false);
	const avatarSeed = user.minecraftUuid ?? '';
	const avatarCandidates = useMemo(() => buildAvatarCandidates(user.minecraftUuid, 96), [user.minecraftUuid]);
	const [avatarState, setAvatarState] = useState<{ seed: string; index: number }>({
		seed: avatarSeed,
		index: 0,
	});
	const avatarIndex = avatarState.seed === avatarSeed ? avatarState.index : 0;
	const avatarSrc = avatarCandidates[avatarIndex] ?? null;

	const getRoleBadge = (role: string) => {
		if (role === 'admin') {
			return <span className="px-2 py-0.5 bg-accent text-white text-xs rounded font-bold">관리자</span>;
		}
		return <span className="px-2 py-0.5 bg-bg-tertiary text-text-secondary text-xs rounded">일반 회원</span>;
	};

	return (
		<div className="bg-bg-secondary rounded-lg p-6 shadow-sm border border-border">
			<div className="flex items-center gap-6">
				{/* 아바타 (마인크래프트 스킨) */}
				<div className="relative">
					<div className="w-24 h-24 rounded-lg overflow-hidden border border-border bg-bg-tertiary">
						{avatarSrc ? (
							<img
								src={avatarSrc}
								alt={user.nickname}
								className="w-full h-full object-cover"
								onError={() => {
									setAvatarState((prev) => ({
										seed: avatarSeed,
										index: prev.seed === avatarSeed ? prev.index + 1 : 1,
									}));
								}}
							/>
						) : (
							<div className="w-full h-full flex items-center justify-center text-3xl font-bold text-text-muted">
								?
							</div>
						)}
					</div>
				</div>

				{/* 사용자 정보 */}
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-2">
						<h2 className="text-2xl font-bold text-text-primary">{user.nickname}</h2>
						{getRoleBadge(user.role)}
					</div>

					<div className="space-y-1 text-sm text-text-secondary">
						<p className="font-mono text-text-muted">UUID: {user.minecraftUuid || '미연동'}</p>
						<p>가입일: {new Date(user.createdAt).toLocaleDateString('ko-KR')}</p>
						<p>
							최근 인증: {' '}
							{user.lastAuthAt
								? new Date(user.lastAuthAt).toLocaleString('ko-KR')
								: '인증 기록 없음'}
						</p>
					</div>
				</div>

				{/* 재인증 버튼 */}
				<div>
					<button
						onClick={() => setIsReauthModalOpen(true)}
						className="btn btn-secondary btn-sm"
					>
						🔄 재인증
					</button>
				</div>
			</div>

			{/* 재인증 모달 */}
			{isReauthModalOpen && (
				<MinecraftReauth onClose={() => setIsReauthModalOpen(false)} />
			)}
		</div>
	);
}
