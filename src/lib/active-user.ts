import type { Session } from "next-auth";
import { toSessionUserId } from "@/lib/session-user";
import { prisma } from "@/lib/prisma";

interface ResolveActiveUserOptions {
	requireApproved?: boolean;
	requireAdmin?: boolean;
}

export interface ActiveUserContext {
	userId: number;
	role: string;
	nickname: string;
	isApproved: number;
	isBanned: number;
}

type ResolveActiveUserResult =
	| {
		ok: true;
		context: ActiveUserContext;
	}
	| {
		ok: false;
		status: number;
		error: "unauthorized" | "pending_approval" | "banned_user" | "forbidden";
	};

export async function resolveActiveUserFromSession(
	session: Session | null,
	options: ResolveActiveUserOptions = {}
): Promise<ResolveActiveUserResult> {
	if (!session?.user) {
		return {
			ok: false,
			status: 401,
			error: "unauthorized",
		};
	}

	const userId = toSessionUserId(session.user.id);
	if (!userId) {
		return {
			ok: false,
			status: 401,
			error: "unauthorized",
		};
	}

	if (!prisma.user || typeof prisma.user.findUnique !== "function") {
		const sessionRole = typeof session.user.role === "string" ? session.user.role : "user";
		const sessionIsApproved = Number(session.user.isApproved ?? 1);
		const sessionIsBanned = Number(session.user.isBanned ?? 0);
		const sessionNickname = typeof session.user.nickname === "string" ? session.user.nickname : "";

		if (sessionIsBanned === 1) {
			return {
				ok: false,
				status: 403,
				error: "banned_user",
			};
		}
		if (options.requireApproved !== false && sessionIsApproved !== 1) {
			return {
				ok: false,
				status: 403,
				error: "pending_approval",
			};
		}
		if (options.requireAdmin && sessionRole !== "admin") {
			return {
				ok: false,
				status: 403,
				error: "forbidden",
			};
		}

		return {
			ok: true,
			context: {
				userId,
				role: sessionRole,
				nickname: sessionNickname,
				isApproved: sessionIsApproved,
				isBanned: sessionIsBanned,
			},
		};
	}

	const dbUser = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			role: true,
			nickname: true,
			isApproved: true,
			isBanned: true,
			deletedAt: true,
		},
	});

	if (!dbUser || dbUser.deletedAt) {
		return {
			ok: false,
			status: 401,
			error: "unauthorized",
		};
	}

	if (dbUser.isBanned === 1) {
		return {
			ok: false,
			status: 403,
			error: "banned_user",
		};
	}

	if (options.requireApproved !== false && dbUser.isApproved !== 1) {
		return {
			ok: false,
			status: 403,
			error: "pending_approval",
		};
	}

	if (options.requireAdmin && dbUser.role !== "admin") {
		return {
			ok: false,
			status: 403,
			error: "forbidden",
		};
	}

	return {
		ok: true,
		context: {
			userId: dbUser.id,
			role: dbUser.role,
			nickname: dbUser.nickname,
			isApproved: dbUser.isApproved,
			isBanned: dbUser.isBanned,
		},
	};
}
