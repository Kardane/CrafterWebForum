"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { AdminBackupInfo, AdminBackupStatus } from "@/types/admin";
import {
	fetchAdminJson,
	fetchAdminResponse,
} from "@/components/admin/utils/fetch-admin";

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
	const [backupSupported, setBackupSupported] = useState(true);

	const loadLatestBackup = useCallback(async () => {
		try {
			const data = await fetchAdminJson<Partial<AdminBackupStatus>>("/api/admin/backup");
			setLatestBackup(data.latestBackup ?? null);
			setBackupSupported(data.backupSupported ?? true);
		} catch (error) {
			if ((error as Error).message !== "AUTH_REQUIRED") {
				console.error(error);
			}
			setLatestBackup(null);
			setBackupSupported(false);
		}
	}, []);

	useEffect(() => {
		void loadLatestBackup();
	}, [loadLatestBackup]);

	const runBackup = async () => {
		if (!backupSupported) {
			setMessage("현재 데이터베이스에서는 파일 백업을 지원하지 않습니다");
			return;
		}

		setRunning(true);
		setMessage(null);
		try {
			const res = await fetchAdminResponse("/api/admin/backup", { method: "POST" });

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
			if ((error as Error).message !== "AUTH_REQUIRED") {
				console.error(error);
				setMessage((error as Error).message);
			}
		} finally {
			setRunning(false);
		}
	};

	return (
		<div>
			<h2 className="mb-2 text-xl font-semibold">백업</h2>
			<p className="mb-4 text-sm text-text-muted">
				로컬 SQLite 환경에서 백업 파일을 생성하고 즉시 다운로드합니다
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
				disabled={running || !backupSupported}
				onClick={() => {
					void runBackup();
				}}
			>
				{running ? "백업 생성 중..." : backupSupported ? "백업 생성" : "백업 미지원"}
			</button>

			{message && <p className="mt-3 text-sm text-text-secondary">{message}</p>}
		</div>
	);
}
