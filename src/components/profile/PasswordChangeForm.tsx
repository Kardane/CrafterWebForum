'use client';

import { useState } from 'react';

export default function PasswordChangeForm() {
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmNewPassword, setConfirmNewPassword] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (newPassword !== confirmNewPassword) {
			alert('새 비밀번호가 일치하지 않습니다.');
			return;
		}

		if (newPassword.length < 8) {
			alert('새 비밀번호는 8자 이상이어야 합니다.');
			return;
		}

		setIsSubmitting(true);

		try {
			const res = await fetch('/api/users/me/password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					currentPassword,
					newPassword,
				}),
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to update password');
			}

			alert('비밀번호가 변경되었습니다. 다시 로그인해주세요.');
			// TODO: 로그아웃 처리 또는 리다이렉트
		} catch (error) {
			console.error('Password update error:', error);
			alert(error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다.');
		} finally {
			setIsSubmitting(false);
			setCurrentPassword('');
			setNewPassword('');
			setConfirmNewPassword('');
		}
	};

	return (
		<div className="bg-bg-secondary rounded-lg p-6 shadow-sm border border-border">
			<h3 className="text-lg font-bold mb-4">비밀번호 변경</h3>
			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label className="block text-sm font-medium mb-1">현재 비밀번호</label>
					<input
						type="password"
						value={currentPassword}
						onChange={(e) => setCurrentPassword(e.target.value)}
						className="input-base w-full"
						required
					/>
				</div>
				<div>
					<label className="block text-sm font-medium mb-1">새 비밀번호</label>
					<input
						type="password"
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
						className="input-base w-full"
						required
						minLength={8}
					/>
					<p className="text-xs text-text-muted mt-1">8자 이상 입력해주세요.</p>
				</div>
				<div>
					<label className="block text-sm font-medium mb-1">새 비밀번호 확인</label>
					<input
						type="password"
						value={confirmNewPassword}
						onChange={(e) => setConfirmNewPassword(e.target.value)}
						className="input-base w-full"
						required
					/>
				</div>
				<div className="pt-2">
					<button
						type="submit"
						disabled={isSubmitting}
						className="btn btn-primary w-full"
					>
						{isSubmitting ? '변경 중...' : '비밀번호 변경'}
					</button>
				</div>
			</form>
		</div>
	);
}
