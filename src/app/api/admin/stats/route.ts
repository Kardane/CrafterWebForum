import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";


export async function GET() {
	try {
		const admin = await requireAdmin();
		if ("response" in admin) return admin.response;

		const [
			users,
			posts,
			comments,
			inquiries,
			pendingUsers,
			pendingInquiries,
		] = await Promise.all([
			prisma.user.count({ where: { deletedAt: null } }),
			prisma.post.count({ where: { deletedAt: null } }),
			prisma.comment.count(),
			prisma.inquiry.count(),
			prisma.user.count({ where: { deletedAt: null, isApproved: 0 } }),
			prisma.inquiry.count({ where: { status: "pending" } }),
		]);

		return NextResponse.json({
			stats: {
				users,
				posts,
				comments,
				inquiries,
				pendingUsers,
				pendingInquiries,
			},
		});
	} catch (error) {
		console.error("[API] GET /api/admin/stats error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

