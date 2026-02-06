"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminUserRow } from "@/types/admin";

type PatchPayload = { role?: "admin" | "user"; isBanned?: 0 | 1 };

function formatDate(date: string | null) {
	if (!date) return "-";
	return new Date(date).toLocaleString();
}

export default function AdminUsersPage() {
	const [users, setUsers] = useState<AdminUserRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const loadUsers = useCallback(async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/admin/users", { cache: "no-store" });
			if (!res.ok) throw new Error("Failed to load users");
			const data = await res.json();
			setUsers(data.users);
			setError(null);
		} catch (e) {
			console.error(e);
			setError("Failed to load users.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadUsers();
	}, [loadUsers]);

	const patchUser = async (id: number, payload: PatchPayload) => {
		const res = await fetch(`/api/admin/users/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!res.ok) throw new Error("Failed to update user");
	};

	const approveUser = async (id: number) => {
		const res = await fetch(`/api/admin/users/${id}/approve`, { method: "POST" });
		if (!res.ok) throw new Error("Failed to approve user");
	};

	const rejectUser = async (id: number) => {
		const res = await fetch(`/api/admin/users/${id}/reject`, { method: "POST" });
		if (!res.ok) throw new Error("Failed to reject user");
	};

	const deleteUser = async (id: number) => {
		const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
		if (!res.ok) throw new Error("Failed to delete user");
	};

	const run = async (fn: () => Promise<void>) => {
		try {
			await fn();
			await loadUsers();
		} catch (e) {
			console.error(e);
			alert("Request failed.");
		}
	};

	if (loading) return <p className="text-text-muted">Loading...</p>;
	if (error) return <p className="text-error">{error}</p>;

	return (
		<div>
			<h2 className="text-xl font-semibold mb-4">Users</h2>
			<div className="overflow-x-auto">
				<table className="w-full text-sm border-collapse">
					<thead>
						<tr className="border-b border-border text-left">
							<th className="py-2 pr-3">ID</th>
							<th className="py-2 pr-3">Nickname</th>
							<th className="py-2 pr-3">Role</th>
							<th className="py-2 pr-3">Approved</th>
							<th className="py-2 pr-3">Banned</th>
							<th className="py-2 pr-3">Created</th>
							<th className="py-2 pr-3">Last Auth</th>
							<th className="py-2 pr-3">Actions</th>
						</tr>
					</thead>
					<tbody>
						{users.map((u) => (
							<tr key={u.id} className="border-b border-border/60 align-top">
								<td className="py-2 pr-3">{u.id}</td>
								<td className="py-2 pr-3">
									<div>{u.nickname}</div>
									<div className="text-xs text-text-muted">{u.email}</div>
								</td>
								<td className="py-2 pr-3">{u.role}</td>
								<td className="py-2 pr-3">{u.isApproved === 1 ? "Yes" : "No"}</td>
								<td className="py-2 pr-3">{u.isBanned === 1 ? "Yes" : "No"}</td>
								<td className="py-2 pr-3">{formatDate(u.createdAt)}</td>
								<td className="py-2 pr-3">{formatDate(u.lastAuthAt)}</td>
								<td className="py-2 pr-3">
									<div className="flex flex-wrap gap-1">
										{u.isApproved === 0 && u.deletedAt === null && (
											<>
												<button
													className="btn btn-success btn-sm"
													onClick={() => run(() => approveUser(u.id))}
												>
													Approve
												</button>
												<button
													className="btn btn-danger btn-sm"
													onClick={() => run(() => rejectUser(u.id))}
												>
													Reject
												</button>
											</>
										)}
										<button
											className="btn btn-secondary btn-sm"
											onClick={() =>
												run(() =>
													patchUser(u.id, { role: u.role === "admin" ? "user" : "admin" })
												)
											}
										>
											Role
										</button>
										<button
											className="btn btn-warning btn-sm"
											onClick={() =>
												run(() =>
													patchUser(u.id, { isBanned: u.isBanned === 1 ? 0 : 1 })
												)
											}
										>
											{u.isBanned === 1 ? "Unban" : "Ban"}
										</button>
										<button
											className="btn btn-danger btn-sm"
											onClick={() => run(() => deleteUser(u.id))}
										>
											Delete
										</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

