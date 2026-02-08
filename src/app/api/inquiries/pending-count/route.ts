import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isPrivilegedNickname } from "@/config/admin-policy";

/**
 * GET /api/inquiries/pending-count
 * 관리자용 미응답 문의 수 조회
 */
export async function GET() {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: "unauthorized" }, { status: 401 });
		}

		const canAccessAdmin =
			session.user.role === "admin" || isPrivilegedNickname(session.user.nickname);

		if (!canAccessAdmin) {
			return NextResponse.json({ count: 0 });
		}

		const count = await prisma.inquiry.count({
			where: { status: "pending", archivedAt: null },
		});

		return NextResponse.json({ count });
	} catch (error) {
		console.error("[API] GET /api/inquiries/pending-count error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
