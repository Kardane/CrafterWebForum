import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { resolveActiveUserFromSession } from "@/lib/active-user";
import { listSidebarTrackedPosts } from "@/lib/services/sidebar-tracked-posts-service";

export const dynamic = "force-dynamic";

function parseLimit(value: string | null): number | undefined {
	if (value === null) {
		return undefined;
	}
	const parsed = Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed <= 0) {
		return undefined;
	}
	return parsed;
}

export async function GET(request: NextRequest) {
	try {
		const session = await auth();
		const activeUser = await resolveActiveUserFromSession(session);
		if (!activeUser.ok) {
			return NextResponse.json({ error: activeUser.error }, { status: activeUser.status });
		}

		const searchParams = new URL(request.url).searchParams;
		const cursor = searchParams.get("cursor");
		const limit = parseLimit(searchParams.get("limit"));
		const result = await listSidebarTrackedPosts({
			userId: activeUser.context.userId,
			cursor,
			limit,
		});

		return NextResponse.json(result);
	} catch (error) {
		console.error("[API] GET /api/sidebar/tracked-posts error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
