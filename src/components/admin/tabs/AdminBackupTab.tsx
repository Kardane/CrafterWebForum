"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { AdminBackupInfo } from "@/types/admin";

function formatDate(date: string) {
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return "-";
	return parsed.toLocaleString("ko-KR");
}

function formatRelative(date: string) {
	const parsed = new Date(date);
	if (Number.isNaN(parsed.getTime())) return "-";
	return formatDistanceToNow(parsed, { addSuffix: true, locale: ko });
}

export default function AdminBackupTab() {
	const [running, setRunning] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [latestBackup, setLatestBackup] = useState<AdminBackupInfo | null>(null);

	const loadLatestBackup = useCallback(async () => {
		try {
			const res = await fetch("/api/admin/backup", { cache: "no-store" });
			if (!res.ok) throw new Error("Failed to load latest backup");
			const data = (await res.json()) as { latestBackup?: AdminBackupInfo | null };
			setLatestBackup(data.latestBackup ?? null);
		} catch (error) {
			console.error(error);
			setLatestBackup(null);
		}
	}, []);

	useEffect(() => {
		void loadLatestBackup();
	}, [loadLatestBackup]);

	const runBackup = async () => {
		setRunning(true);
		setMessage(null);
		try {
			const res = await fetch("/api/admin/backup", { method: "POST" });
			if (!res.ok) {
				const errorData = (await res.json().catch(() => null)) as { error?: string } | null;
				throw new Error(errorData?.error ?? "Backup failed");
			}

			const disposition = res.headers.get("content-disposition") ?? "";
			const match = disposition.match(/filename="(.+)"/);
			const filename = match?.[1] ?? `backup-${Date.now()}.db`;
			const blob = await res.blob();
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = filename;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(url);

			await loadLatestBackup();
			setMessage(`백업 다운로드 완료: ${filename}`);
		} catch (error) {
			console.error(error);
			setMessage((error as Error).message);
		} finally {
			setRunning(false);
		}
	};

	return (
		<div>
			<h2 className="mb-2 text-xl font-semibold">백업</h2>
			<p className="mb-4 text-sm text-text-muted">
				SQLite 백업 파일을 생성하고 즉시 다운로드합니다
			</p>

			<div className="mb-4 rounded border border-border bg-bg-tertiary/40 p-3 text-sm">
				<div className="text-text-muted">최근 백업 일자</div>
				{latestBackup ? (
					<div className="mt-1 text-text-primary">
						{formatDate(latestBackup.createdAt)} ({formatRelative(latestBackup.createdAt)})
					</div>
				) : (
					<div className="mt-1 text-text-muted">백업 기록이 없습니다</div>
				)}
			</div>

			<button
				className="btn btn-primary"
				disabled={running}
				onClick={() => {
					void runBackup();
				}}
			>
				{running ? "백업 생성 중..." : "백업 생성"}
			</button>

			{message && <p className="mt-3 text-sm text-text-secondary">{message}</p>}
		</div>
	);
}
