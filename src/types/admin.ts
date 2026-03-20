export interface AdminCoreTrendPoint {
	date: string;
	users: number;
	posts: number;
	comments: number;
}

export interface AdminStats {
	users: number;
	posts: number;
	comments: number;
	pendingUsers: number;
	coreTrend: AdminCoreTrendPoint[];
}

export interface AdminUserRow {
	id: number;
	email: string;
	nickname: string;
	role: string;
	isApproved: number;
	isBanned: number;
	createdAt: string;
	lastAuthAt: string | null;
	deletedAt: string | null;
	signupNote: string | null;
	minecraftUuid: string | null;
}

export interface AdminCreateUserPayload {
	nickname: string;
	password: string;
	signupNote?: string;
}

export interface AdminPostRow {
	id: number;
	title: string;
	board: string | null;
	serverAddress: string | null;
	createdAt: string;
	deletedAt: string | null;
	authorId: number;
	authorName: string;
}

export interface AdminBackupInfo {
	filename: string;
	createdAt: string;
	size: number;
}

export interface AdminBackupStatus {
	latestBackup: AdminBackupInfo | null;
	backupSupported: boolean;
	backupReason: string | null;
}
