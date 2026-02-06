import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/client";
import { requireAdmin } from "@/lib/admin-auth";

const prisma = new PrismaClient();

export async function GET() {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const users = await prisma.user.findMany({
			orderBy: { createdAt: "desc" },
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

		return NextResponse.json({ users });
	} catch (error) {
		console.error("[API] GET /api/admin/users error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

