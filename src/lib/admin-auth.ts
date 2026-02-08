import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Session } from "next-auth";
import { isPrivilegedNickname } from "@/config/admin-policy";

export async function requireAdmin(): Promise<
	| { session: Session }
	| { response: NextResponse }
> {
	const session = await auth();
	if (!session?.user) {
		return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
	}

	const hasAdminRole = session.user.role === "admin";
	const hasPrivilegedNickname = isPrivilegedNickname(session.user.nickname);
	if (!hasAdminRole && !hasPrivilegedNickname) {
		return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
	}
	return { session };
}
