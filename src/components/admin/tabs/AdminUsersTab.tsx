"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { MoreHorizontal, Check, X, Shield, Ban, Trash2 } from "lucide-react";
import { AdminCreateUserPayload, AdminUserRow } from "@/types/admin";
import { Modal } from "@/components/ui/Modal";
import {
	fetchAdminJson,
	fetchAdminResponse,
} from "@/components/admin/utils/fetch-admin";
import { useRealtimeBroadcast } from "@/lib/realtime/useRealtimeBroadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";

type PatchPayload = { role?: "admin" | "user"; isBanned?: 0 | 1 };
type UserStatus = "정상" | "승인대기" | "차단";
const PASSWORD_POLICY_TEXT = "비밀번호는 8자 이상이며 숫자 또는 특수문자를 포함해야 함";

function formatDate24Hour(date: string | null) {
	if (!date) return "-";
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return "-";
	return parsed.toLocaleString("ko-KR", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
}

function formatRelativeDate(date: string | null) {
	if (!date) return "-";
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return "-";
	return formatDistanceToNow(parsed, { addSuffix: true, locale: ko });
}

function getUserStatus(user: AdminUserRow): UserStatus {
	if (user.deletedAt || user.isBanned === 1) {
		return "차단";
	}
	if (user.isApproved === 0) {
		return "승인대기";
	}
	return "정상";
}

function getStatusClass(status: UserStatus) {
	if (status === "정상") {
		return "border border-success/40 bg-success/20 text-success";
	}
	if (status === "승인대기") {
		return "border border-warning/40 bg-warning/20 text-warning";
	}
	return "border border-error/40 bg-error/20 text-error";
}

export default function AdminUsersTab() {
	const [users, setUsers] = useState<AdminUserRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
	const [isActionLoading, setIsActionLoading] = useState(false);
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [createNickname, setCreateNickname] = useState("");
	const [createPassword, setCreatePassword] = useState("");
	const [createPasswordConfirm, setCreatePasswordConfirm] = useState("");
	const [createSignupNote, setCreateSignupNote] = useState("");
	const [createError, setCreateError] = useState<string | null>(null);
	const [isCreateLoading, setIsCreateLoading] = useState(false);

	const selectedUser = useMemo(
		() => users.find((user) => user.id === selectedUserId) ?? null,
		[users, selectedUserId]
	);

	const loadUsers = useCallback(async () => {
		setLoading(true);
		try {
			const data = await fetchAdminJson<{ users: AdminUserRow[] }>("/api/admin/users");
			setUsers(data.users);
			setError(null);
		} catch (e) {
			const isAuthError = (e as Error).message === "AUTH_REQUIRED";
			if (!isAuthError) {
				console.error(e);
				setError("유저 목록을 불러오지 못했습니다");
			}
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadUsers();
	}, [loadUsers]);

	useRealtimeBroadcast(REALTIME_TOPICS.adminUsers(), {
		[REALTIME_EVENTS.ADMIN_USER_APPROVAL_UPDATED]: () => {
			void loadUsers();
		},
	});

	const patchUser = async (id: number, payload: PatchPayload) => {
		await fetchAdminResponse(`/api/admin/users/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
	};

	const approveUser = async (id: number) => {
		await fetchAdminResponse(`/api/admin/users/${id}/approve`, { method: "POST" });
	};

	const rejectUser = async (id: number) => {
		await fetchAdminResponse(`/api/admin/users/${id}/reject`, { method: "POST" });
	};

	const deleteUser = async (id: number) => {
		await fetchAdminResponse(`/api/admin/users/${id}`, { method: "DELETE" });
	};

	const createUser = async (payload: AdminCreateUserPayload) => {
		await fetchAdminResponse("/api/admin/users", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
	};

	const resetCreateForm = () => {
		setCreateNickname("");
		setCreatePassword("");
		setCreatePasswordConfirm("");
		setCreateSignupNote("");
		setCreateError(null);
	};

	const handleCreateSubmit = async () => {
		const nickname = createNickname.trim();
		if (!nickname) {
			setCreateError("닉네임을 입력해줘");
			return;
		}
		if (createPassword !== createPasswordConfirm) {
			setCreateError("비밀번호 확인이 일치하지 않음");
			return;
		}

		setIsCreateLoading(true);
		try {
			await createUser({
				nickname,
				password: createPassword,
				signupNote: createSignupNote.trim(),
			});
			await loadUsers();
			resetCreateForm();
			setIsCreateModalOpen(false);
		} catch (e) {
			if ((e as Error).message === "AUTH_REQUIRED") {
				return;
			}
			const message = (e as Error).message;
			if (message === "nickname_already_exists") {
				setCreateError("이미 존재하는 닉네임임");
			} else if (message === "invalid_password_policy") {
				setCreateError(PASSWORD_POLICY_TEXT);
			} else if (message === "validation_error") {
				setCreateError("입력값을 다시 확인해줘");
			} else {
				setCreateError("유저 생성에 실패함");
			}
		} finally {
			setIsCreateLoading(false);
		}
	};

	const runAction = async (action: () => Promise<void>, closeAfterAction = true) => {
		setIsActionLoading(true);
		try {
			await action();
			await loadUsers();
			if (closeAfterAction) {
				setSelectedUserId(null);
			}
		} catch (e) {
			if ((e as Error).message !== "AUTH_REQUIRED") {
				console.error(e);
				alert("요청 처리에 실패했습니다");
			}
		} finally {
			setIsActionLoading(false);
		}
	};

	if (loading) return <p className="text-text-muted">불러오는 중...</p>;
	if (error) return <p className="text-error">{error}</p>;

	return (
		<div>
			<div className="mb-4 flex items-center justify-between gap-3">
				<h2 className="text-xl font-semibold">유저</h2>
				<button
					type="button"
					className="btn btn-primary btn-sm"
					onClick={() => {
						resetCreateForm();
						setIsCreateModalOpen(true);
					}}
				>
					유저 생성
				</button>
			</div>
			<div className="overflow-x-auto">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="border-b border-border text-left">
							<th className="py-2 pr-3">ID</th>
							<th className="py-2 pr-3">닉네임</th>
							<th className="py-2 pr-3">권한</th>
							<th className="py-2 pr-3">상태</th>
							<th className="py-2 pr-3">가입일</th>
							<th className="py-2 pr-3">최근 접속</th>
							<th className="py-2 pr-3">작업</th>
						</tr>
					</thead>
					<tbody>
						{users.map((user) => {
							const status = getUserStatus(user);
							return (
								<tr key={user.id} className="align-top border-b border-border/60">
									<td className="py-2 pr-3">{user.id}</td>
									<td className="py-2 pr-3">
										<div>{user.nickname}</div>
									</td>
									<td className="py-2 pr-3">{user.role === "admin" ? "관리자" : "사용자"}</td>
									<td className="py-2 pr-3">
										<span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getStatusClass(status)}`}>
											{status}
										</span>
									</td>
									<td className="py-2 pr-3">{formatDate24Hour(user.createdAt)}</td>
									<td className="py-2 pr-3">{formatRelativeDate(user.lastAuthAt)}</td>
									<td className="py-2 pr-3">
										<button
											type="button"
											className="btn btn-secondary btn-sm !px-2"
											onClick={() => setSelectedUserId(user.id)}
											title="작업 메뉴"
										>
											<MoreHorizontal size={14} />
										</button>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			<Modal
				isOpen={isCreateModalOpen}
				onClose={() => {
					resetCreateForm();
					setIsCreateModalOpen(false);
				}}
				title="관리자 직접 유저 생성"
				variant="sidebarLike"
				size="sm"
				onEnter={() => void handleCreateSubmit()}
			>
				<div className="space-y-4">
					<div className="text-xs text-text-muted">{PASSWORD_POLICY_TEXT}</div>
					<div className="space-y-1.5">
						<label className="text-sm font-medium text-text-secondary" htmlFor="admin-create-nickname">
							닉네임
						</label>
						<input
							id="admin-create-nickname"
							value={createNickname}
							onChange={(event) => setCreateNickname(event.target.value)}
							className="input-base w-full"
							maxLength={32}
							placeholder="닉네임"
						/>
					</div>
					<div className="space-y-1.5">
						<label className="text-sm font-medium text-text-secondary" htmlFor="admin-create-password">
							비밀번호
						</label>
						<input
							id="admin-create-password"
							type="password"
							value={createPassword}
							onChange={(event) => setCreatePassword(event.target.value)}
							className="input-base w-full"
							placeholder="비밀번호"
						/>
					</div>
					<div className="space-y-1.5">
						<label className="text-sm font-medium text-text-secondary" htmlFor="admin-create-password-confirm">
							비밀번호 확인
						</label>
						<input
							id="admin-create-password-confirm"
							type="password"
							value={createPasswordConfirm}
							onChange={(event) => setCreatePasswordConfirm(event.target.value)}
							className="input-base w-full"
							placeholder="비밀번호 확인"
						/>
					</div>
					<div className="space-y-1.5">
						<label className="text-sm font-medium text-text-secondary" htmlFor="admin-create-signup-note">
							가입 메모
						</label>
						<textarea
							id="admin-create-signup-note"
							value={createSignupNote}
							onChange={(event) => setCreateSignupNote(event.target.value)}
							className="input-base min-h-[88px] w-full"
							placeholder="선택 입력"
						/>
					</div>
					{createError && <p className="text-sm text-error">{createError}</p>}
					<div className="flex justify-end gap-2">
						<button
							type="button"
							className="btn btn-secondary btn-sm"
							onClick={() => {
								resetCreateForm();
								setIsCreateModalOpen(false);
							}}
							disabled={isCreateLoading}
						>
							취소
						</button>
						<button
							type="button"
							className="btn btn-primary btn-sm"
							onClick={() => void handleCreateSubmit()}
							disabled={isCreateLoading}
						>
							{isCreateLoading ? "생성 중..." : "생성"}
						</button>
					</div>
				</div>
			</Modal>

			<Modal
				isOpen={selectedUser !== null}
				onClose={() => setSelectedUserId(null)}
				title={selectedUser ? `${selectedUser.nickname} 관리` : "유저 관리"}
				variant="sidebarLike"
				size="sm"
			>
				{selectedUser && (
					<div className="space-y-3">
						<div className="rounded border border-border bg-bg-secondary/70 p-3 text-xs text-text-secondary">
							<div>UUID: {selectedUser.minecraftUuid ?? "-"}</div>
							<div className="mt-1">가입 메시지: {selectedUser.signupNote ?? "-"}</div>
							<div className="mt-1">최근 접속: {formatRelativeDate(selectedUser.lastAuthAt)}</div>
						</div>

						{selectedUser.deletedAt ? (
							<p className="text-sm text-text-muted">삭제된 계정은 추가 작업을 진행할 수 없습니다</p>
						) : (
							<div className="grid gap-2.5">
								{selectedUser.isApproved === 0 ? (
									<>
										<button
											type="button"
											className="btn btn-success flex items-center justify-center gap-2 py-2.5"
											disabled={isActionLoading}
											onClick={() => {
												void runAction(() => approveUser(selectedUser.id));
											}}
										>
											<Check size={16} />
											승인
										</button>
										<button
											type="button"
											className="btn btn-danger flex items-center justify-center gap-2 py-2.5"
											disabled={isActionLoading}
											onClick={() => {
												void runAction(() => rejectUser(selectedUser.id));
											}}
										>
											<X size={16} />
											거절
										</button>
									</>
								) : (
									<>
										<button
											type="button"
											className="btn btn-secondary flex items-center justify-center gap-2 py-2.5"
											disabled={isActionLoading}
											onClick={() => {
												void runAction(() =>
													patchUser(selectedUser.id, {
														role: selectedUser.role === "admin" ? "user" : "admin",
													})
												);
											}}
										>
											<Shield size={16} className={selectedUser.role === "admin" ? "text-error" : "text-success"} />
											{selectedUser.role === "admin" ? "일반 사용자로 변경" : "관리자 권한 부여"}
										</button>

										<button
											type="button"
											className="btn btn-secondary flex items-center justify-center gap-2 py-2.5"
											disabled={isActionLoading}
											onClick={() => {
												void runAction(() =>
													patchUser(selectedUser.id, {
														isBanned: selectedUser.isBanned === 1 ? 0 : 1,
													})
												);
											}}
										>
											<Ban size={16} className={selectedUser.isBanned === 1 ? "text-success" : "text-error"} />
											{selectedUser.isBanned === 1 ? "차단 해제" : "차단"}
										</button>

										<button
											type="button"
											className="btn btn-danger flex items-center justify-center gap-2 py-2.5"
											disabled={isActionLoading}
											onClick={() => {
												void runAction(() => deleteUser(selectedUser.id));
											}}
										>
											<Trash2 size={16} />
											삭제
										</button>
									</>
								)}
							</div>
						)}

						<div className="flex justify-end">
							<button type="button" className="btn btn-secondary" onClick={() => setSelectedUserId(null)}>
								닫기
							</button>
						</div>
					</div>
				)}
			</Modal>
		</div>
	);
}
