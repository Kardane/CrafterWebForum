import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@/generated/client";
import { requireAdmin } from "@/lib/admin-auth";

const prisma = new PrismaClient();

function makeIdentitySuffix(mode: "deleted" | "rejected", id: number) {
	return `_${mode}_${id}_${Date.now()}`;
}

export async function PATCH(
	request: NextRequest,
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

		const body = (await request.json()) as { role?: string; isBanned?: number };
		const hasRole = typeof body.role !== "undefined";
		const hasBan = typeof body.isBanned !== "undefined";
		if (!hasRole && !hasBan) {
			return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
		}

		const target = await prisma.user.findUnique({ where: { id: userId } });
		if (!target) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		const data: { role?: string; isBanned?: number } = {};
		if (hasRole) {
			if (body.role !== "admin" && body.role !== "user") {
				return NextResponse.json({ error: "Invalid role" }, { status: 400 });
			}
			if (target.role === "admin" && body.role === "user") {
				const otherAdmins = await prisma.user.count({
					where: {
						role: "admin",
						deletedAt: null,
						id: { not: userId },
					},
				});
				if (otherAdmins === 0) {
					return NextResponse.json(
						{ error: "Cannot demote the last admin" },
						{ status: 400 }
					);
				}
			}
			data.role = body.role;
		}

		if (hasBan) {
			if (body.isBanned !== 0 && body.isBanned !== 1) {
				return NextResponse.json({ error: "Invalid ban value" }, { status: 400 });
			}
			data.isBanned = body.isBanned;
		}

		const updated = await prisma.user.update({
			where: { id: userId },
			data,
			select: {
				id: true,
				role: true,
				isBanned: true,
				isApproved: true,
				deletedAt: true,
			},
		});

		console.info(
			`[Admin] User updated by ${admin.session.user.id}: target=${userId}`
		);

		return NextResponse.json({ success: true, user: updated });
	} catch (error) {
		console.error("[API] PATCH /api/admin/users/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(
	_request: NextRequest,
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
				{ error: "Cannot delete your own account" },
				{ status: 400 }
			);
		}

		const target = await prisma.user.findUnique({ where: { id: userId } });
		if (!target) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		const suffix = makeIdentitySuffix("deleted", userId);
		await prisma.user.update({
			where: { id: userId },
			data: {
				deletedAt: new Date(),
				nickname: `${target.nickname}${suffix}`,
				email: `${target.email}${suffix}`,
				minecraftUuid: null,
			},
		});

		console.warn(
			`[Admin] User soft deleted by ${admin.session.user.id}: target=${userId}`
		);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[API] DELETE /api/admin/users/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

