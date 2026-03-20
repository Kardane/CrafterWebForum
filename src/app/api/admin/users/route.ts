import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";
import { z } from "zod";

function parsePositiveInt(value: string | null, fallback: number, max: number) {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return fallback;
	}
	return Math.min(parsed, max);
}

const adminCreateUserBodySchema = z.object({
	nickname: z.string().trim().min(1).max(32),
	password: z.string().min(1),
	signupNote: z.string().optional().default(""),
});

const ADMIN_CREATE_PASSWORD_REGEX = /^(?=.*[0-9!@#$%^&*])(?=.{8,})/;

export async function GET(request: Request) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;
		const searchParams = new URL(request.url).searchParams;
		const page = parsePositiveInt(searchParams.get("page"), 1, 100_000);
		const limit = parsePositiveInt(searchParams.get("limit"), 50, 200);
		const skip = (page - 1) * limit;

		const [users, total] = await Promise.all([
			prisma.user.findMany({
				orderBy: { createdAt: "desc" },
				skip,
				take: limit,
				select: {
					id: true,
					email: true,
					nickname: true,
					role: true,
					isApproved: true,
					isBanned: true,
					createdAt: true,
					lastAuthAt: true,
					deletedAt: true,
					signupNote: true,
					minecraftUuid: true,
				},
			}),
			prisma.user.count(),
		]);

		return NextResponse.json({
			users,
			page: {
				page,
				limit,
				total,
				totalPages: Math.max(1, Math.ceil(total / limit)),
				hasMore: skip + users.length < total,
			},
		});
	} catch (error) {
		console.error("[API] GET /api/admin/users error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const parsedBody = adminCreateUserBodySchema.safeParse(
			await readJsonBody(request, { maxBytes: 64 * 1024 })
		);
		if (!parsedBody.success) {
			return NextResponse.json({ error: "validation_error" }, { status: 400 });
		}

		const nickname = parsedBody.data.nickname.trim();
		const password = parsedBody.data.password;
		const signupNote = parsedBody.data.signupNote.trim();

		if (!ADMIN_CREATE_PASSWORD_REGEX.test(password)) {
			return NextResponse.json({ error: "invalid_password_policy" }, { status: 400 });
		}

		const existingUser = await prisma.user.findFirst({
			where: {
				nickname,
				deletedAt: null,
			},
			select: { id: true },
		});
		if (existingUser) {
			return NextResponse.json({ error: "nickname_already_exists" }, { status: 400 });
		}

		const hashedPassword = await hash(password, 10);
		const createdUser = await prisma.user.create({
			data: {
				email: `${nickname}@crafter.local`,
				nickname,
				password: hashedPassword,
				role: "user",
				isApproved: 1,
				isBanned: 0,
				emailVerified: 1,
				minecraftUuid: null,
				minecraftNickname: null,
				lastAuthAt: null,
				signupNote: signupNote || "",
			},
			select: {
				id: true,
				email: true,
				nickname: true,
				role: true,
				isApproved: true,
				isBanned: true,
				createdAt: true,
				lastAuthAt: true,
				deletedAt: true,
				signupNote: true,
				minecraftUuid: true,
			},
		});

		console.info(`[Admin] User created by ${admin.session.user.id}: target=${createdUser.id}`);
		void broadcastRealtime({
			topic: REALTIME_TOPICS.adminUsers(),
			event: REALTIME_EVENTS.ADMIN_USER_APPROVAL_UPDATED,
			payload: { userId: createdUser.id, action: "created", user: createdUser },
		});

		return NextResponse.json({ success: true, user: createdUser }, { status: 201 });
	} catch (error) {
		if (error instanceof JsonBodyError) {
			return NextResponse.json({ error: error.code }, { status: error.status });
		}
		console.error("[API] POST /api/admin/users error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
