export interface AdminStats {
	users: number;
	posts: number;
	comments: number;
	inquiries: number;
	pendingUsers: number;
	pendingInquiries: number;
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

export interface AdminPostRow {
	id: number;
	title: string;
	createdAt: string;
	deletedAt: string | null;
	authorId: number;
	authorName: string;
}

export interface AdminInquiryRow {
	id: number;
	title: string;
	status: string;
	createdAt: string;
	authorId: number;
	authorName: string;
}

