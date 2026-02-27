import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { toSessionUserId } from "@/lib/session-user";

export async function requireAdmin(): Promise<
	| { session: Session }
	| { response: NextResponse }
> {
	const session = await auth();
	if (!session?.user) {
		return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
	}

	let role = session.user.role;
	const sessionUserId = toSessionUserId(session.user.id);

	if (!role && sessionUserId) {
		const dbUser = await prisma.user.findUnique({
			where: { id: sessionUserId },
			select: { role: true, deletedAt: true },
		});
		if (dbUser?.deletedAt) {
			return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
		}
		if (dbUser) {
			role = role ?? dbUser.role;
		}
	}

	if (role !== "admin") {
		return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
	}
	return { session };
}
