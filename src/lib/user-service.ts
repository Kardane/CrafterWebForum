import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizeBoardType } from "@/lib/post-board";

export interface UserProfileResult {
	user: {
		id: number;
		email: string;
		nickname: string;
		minecraftUuid: string | null;
		role: string;
		createdAt: Date;
		lastAuthAt: Date | null;
	};
	stats: {
		posts: number;
		developePosts: number;
		sinmungoPosts: number;
		comments: number;
		likesReceived: number;
	};
	last_auth_at: Date | null;
}

export async function getUserProfile(userId: number): Promise<UserProfileResult | null> {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			email: true,
			nickname: true,
			minecraftUuid: true,
			role: true,
			createdAt: true,
			lastAuthAt: true,
		},
	});
	if (!user) {
		return null;
	}

	const [posts, commentCount, likesAggregate] = await Promise.all([
		prisma.post.findMany({
			where: { authorId: user.id, deletedAt: null },
			select: { board: true },
		}),
		prisma.comment.count({ where: { authorId: user.id } }),
		prisma.post.aggregate({
			where: { authorId: user.id, deletedAt: null },
			_sum: { likes: true },
		}),
	]);

	const developePosts = posts.filter((post) => normalizeBoardType(post.board) === "develope").length;
	const sinmungoPosts = posts.filter((post) => normalizeBoardType(post.board) === "sinmungo").length;

	return {
		user,
		stats: {
			posts: posts.length,
			developePosts,
			sinmungoPosts,
			comments: commentCount,
			likesReceived: likesAggregate._sum.likes ?? 0,
		},
		last_auth_at: user.lastAuthAt,
	};
}

export type ChangePasswordResult =
	| { ok: true }
	| { ok: false; reason: "validation_error" | "user_not_found" | "wrong_password" };

export async function changeUserPassword(
	userId: number,
	currentPassword: unknown,
	newPassword: unknown
): Promise<ChangePasswordResult> {
	if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
		return { ok: false, reason: "validation_error" };
	}

	if (!currentPassword || newPassword.length < 8) {
		return { ok: false, reason: "validation_error" };
	}

	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: {
			id: true,
			password: true,
		},
	});
	if (!user) {
		return { ok: false, reason: "user_not_found" };
	}

	const isPasswordValid = await compare(currentPassword, user.password);
	if (!isPasswordValid) {
		return { ok: false, reason: "wrong_password" };
	}

	const hashedPassword = await hash(newPassword, 10);
	await prisma.user.update({
		where: { id: user.id },
		data: { password: hashedPassword },
	});

	return { ok: true };
}

export async function updateMinecraftIdentity(
	userId: number,
	nickname: string,
	uuid: string
): Promise<{ lastAuthAt: Date | null }> {
	return prisma.user.update({
		where: { id: userId },
		data: {
			nickname,
			minecraftNickname: nickname,
			minecraftUuid: uuid,
			lastAuthAt: new Date(),
		},
		select: {
			lastAuthAt: true,
		},
	});
}
