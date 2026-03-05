import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";

function parsePositiveInt(value: string | null, fallback: number, max: number) {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return fallback;
	}
	return Math.min(parsed, max);
}


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
