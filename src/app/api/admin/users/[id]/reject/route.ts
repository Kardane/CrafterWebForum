import { NextResponse } from "next/server";
import { PrismaClient } from "@/generated/client";
import { requireAdmin } from "@/lib/admin-auth";

const prisma = new PrismaClient();

function makeIdentitySuffix(id: number) {
	return `_rejected_${id}_${Date.now()}`;
}

export async function POST(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const { id } = await params;
		const userId = parseInt(id, 10);
		if (Number.isNaN(userId)) {
			return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
		}
		if (userId === admin.session.user.id) {
			return NextResponse.json(
				{ error: "Cannot reject your own account" },
				{ status: 400 }
			);
		}

		const target = await prisma.user.findUnique({ where: { id: userId } });
		if (!target) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		const suffix = makeIdentitySuffix(userId);
		await prisma.user.update({
			where: { id: userId },
			data: {
				isApproved: 0,
				deletedAt: new Date(),
				nickname: `${target.nickname}${suffix}`,
				email: `${target.email}${suffix}`,
				minecraftUuid: null,
			},
		});

		console.warn(`[Admin] User rejected by ${admin.session.user.id}: target=${userId}`);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[API] POST /api/admin/users/[id]/reject error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

