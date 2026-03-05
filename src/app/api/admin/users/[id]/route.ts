import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { broadcastRealtime } from "@/lib/realtime/server-broadcast";
import { REALTIME_EVENTS, REALTIME_TOPICS } from "@/lib/realtime/constants";
import { JsonBodyError, readJsonBody } from "@/lib/http-body";
import { z } from "zod";


function makeIdentitySuffix(mode: "deleted" | "rejected", id: number) {
	return `_${mode}_${id}_${Date.now()}`;
}

const adminUserPatchBodySchema = z.object({
	role: z.enum(["admin", "user"]).optional(),
	isBanned: z
		.preprocess(
			(value) => (typeof value === "string" ? Number.parseInt(value, 10) : value),
			z.union([z.literal(0), z.literal(1)])
		)
		.optional(),
});

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

		const parsedBody = adminUserPatchBodySchema.safeParse(
			await readJsonBody(request, { maxBytes: 64 * 1024 })
		);
		if (!parsedBody.success) {
			const hasRoleIssue = parsedBody.error.issues.some((issue) => issue.path[0] === "role");
			return NextResponse.json(
				{ error: hasRoleIssue ? "Invalid role" : "Invalid ban value" },
				{ status: 400 }
			);
		}
		const hasRole = typeof parsedBody.data.role !== "undefined";
		const hasBan = typeof parsedBody.data.isBanned !== "undefined";
		if (!hasRole && !hasBan) {
			return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
		}

		const target = await prisma.user.findUnique({ where: { id: userId } });
		if (!target) {
			return NextResponse.json({ error: "User not found" }, { status: 404 });
		}

		const data: { role?: string; isBanned?: number } = {};
		if (hasRole) {
			if (target.role === "admin" && parsedBody.data.role === "user") {
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
			data.role = parsedBody.data.role;
		}

		if (hasBan) {
			data.isBanned = parsedBody.data.isBanned;
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
		void broadcastRealtime({
			topic: REALTIME_TOPICS.adminUsers(),
			event: REALTIME_EVENTS.ADMIN_USER_APPROVAL_UPDATED,
			payload: { userId, action: "updated", user: updated },
		});

		return NextResponse.json({ success: true, user: updated });
	} catch (error) {
		if (error instanceof JsonBodyError) {
			return NextResponse.json({ error: error.code }, { status: error.status });
		}
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
		void broadcastRealtime({
			topic: REALTIME_TOPICS.adminUsers(),
			event: REALTIME_EVENTS.ADMIN_USER_APPROVAL_UPDATED,
			payload: { userId, action: "deleted" },
		});
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[API] DELETE /api/admin/users/[id] error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}
