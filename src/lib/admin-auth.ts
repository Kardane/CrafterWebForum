import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { Session } from "next-auth";

export async function requireAdmin(): Promise<
	| { session: Session }
	| { response: NextResponse }
> {
	const session = await auth();
	if (!session?.user) {
		return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
	}
	if (session.user.role !== "admin") {
		return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
	}
	return { session };
}
