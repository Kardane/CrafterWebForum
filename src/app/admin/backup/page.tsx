"use client";

import { useState } from "react";

export default function AdminBackupPage() {
	const [running, setRunning] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

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
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
			setMessage(`Backup downloaded: ${filename}`);
		} catch (e) {
			console.error(e);
			setMessage((e as Error).message);
		} finally {
			setRunning(false);
		}
	};

	return (
		<div>
			<h2 className="text-xl font-semibold mb-2">Backup</h2>
			<p className="text-sm text-text-muted mb-4">
				Create a SQLite backup and download it immediately.
			</p>
			<button
				className="btn btn-primary"
				disabled={running}
				onClick={() => {
					void runBackup();
				}}
			>
				{running ? "Creating backup..." : "Create Backup"}
			</button>
			{message && <p className="mt-3 text-sm text-text-secondary">{message}</p>}
		</div>
	);
}

