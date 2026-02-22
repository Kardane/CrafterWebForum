'use client';

import { useMinecraftAuthPolling } from '@/components/auth/useMinecraftAuthPolling';

interface MinecraftReauthProps {
	onClose: () => void;
}

export default function MinecraftReauth({ onClose }: MinecraftReauthProps) {
	const {
		code,
		timeRemaining,
		isPolling,
		isLoading,
		error,
	} = useMinecraftAuthPolling({
		autoStart: true,
		refreshOnExpire: false,
		codeErrorMessage: '인증 코드 발급에 실패했습니다.',
		expireErrorMessage: '인증 시간이 만료되었습니다. 다시 시도해주세요.',
		createCode: async (signal) => {
			const res = await fetch('/api/users/me/minecraft-reauth', {
				method: 'POST',
				signal,
			});
			const data = (await res.json()) as { code?: string; expiresIn?: number; error?: string };
			if (!res.ok || !data.code) {
				throw new Error(data.error || 'Failed to generate code');
			}
			return {
				code: data.code,
				expiresIn: Number(data.expiresIn ?? 300),
			};
		},
		pollVerification: async ({ signal }) => {
			const res = await fetch('/api/users/me/minecraft-reauth', { signal });
			if (!res.ok) {
				return { verified: false };
			}
			const data = (await res.json()) as { verified?: boolean };
			return {
				verified: Boolean(data.verified),
			};
		},
		onVerified: () => {
			alert('인증이 완료되었습니다! 정보가 업데이트되었습니다.');
			window.location.reload();
		},
		onPollError: (nextError) => {
			console.error('Polling error:', nextError);
		},
	});

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
			<div className="bg-bg-primary rounded-xl shadow-xl border border-border w-full max-w-md relative overflow-hidden">
				{/* 닫기 버튼 */}
				<button
					onClick={onClose}
					className="absolute top-4 right-4 text-text-muted hover:text-text-primary transition-colors"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="24"
						height="24"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>

				<div className="p-8 text-center">
					<h2 className="text-2xl font-bold mb-2">마인크래프트 재인증</h2>
					<p className="text-text-muted mb-6 text-sm">
						서버에 접속하여 아래 코드를 입력하세요.<br />
						닉네임이 변경된 경우 자동으로 업데이트됩니다.
					</p>

					{isLoading ? (
						<div className="py-8">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto"></div>
							<p className="mt-4 text-sm text-text-secondary">코드 생성 중...</p>
						</div>
					) : error ? (
						<div className="py-8 text-error">
							<p className="mb-4">{error}</p>
							<button onClick={onClose} className="btn btn-secondary btn-sm">
								닫기
							</button>
						</div>
					) : (
						<div className="space-y-6">
							{/* 코드 디스플레이 */}
							<div className="bg-bg-tertiary border border-border rounded-lg p-6">
								<div className="text-4xl font-mono font-bold text-accent tracking-widest mb-2">
									{code}
								</div>
								<div className="text-xs text-text-muted bg-bg-secondary inline-block px-3 py-1 rounded">
									/forum auth {code}
								</div>
							</div>

							{/* 타이머 */}
							<div className="text-center">
								<p className="text-sm text-text-secondary mb-1">남은 시간</p>
								<p className="text-xl font-bold font-mono text-warning">
									{Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
								</p>
							</div>

							{isPolling && (
								<div className="flex items-center justify-center gap-2 text-xs text-text-muted">
									<div className="animate-pulse w-2 h-2 rounded-full bg-accent"></div>
									인증 대기 중...
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
