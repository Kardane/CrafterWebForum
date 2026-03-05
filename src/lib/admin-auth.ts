import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Session } from "next-auth";
import { resolveActiveUserFromSession } from "@/lib/active-user";

export async function requireAdmin(): Promise<
	| { session: Session }
	| { response: NextResponse }
> {
	const session = await auth();
	const activeUser = await resolveActiveUserFromSession(session, {
		requireApproved: false,
		requireAdmin: true,
	});
	if (!activeUser.ok) {
		return { response: NextResponse.json({ error: activeUser.error }, { status: activeUser.status }) };
	}
	if (!session) {
		return { response: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
	}
	return { session };
}
