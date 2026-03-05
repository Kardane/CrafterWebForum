import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";
import { parseServerAddress } from "@/lib/server-address";
import { isMinecraftServerReachable } from "@/lib/minecraft-server-check";
import { resolvePublicIps } from "@/lib/network-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const rateLimited = await enforceRateLimitAsync(request, RATE_LIMIT_POLICIES.serverAddressCheck);
	if (rateLimited) {
		return rateLimited;
	}

	const address = request.nextUrl.searchParams.get("address")?.trim() ?? "";
	const parsed = parseServerAddress(address);
	if (!parsed) {
		return NextResponse.json({ error: "invalid_server_address" }, { status: 400 });
	}

	try {
		await resolvePublicIps(parsed.host);
	} catch {
		return NextResponse.json({ error: "invalid_server_address" }, { status: 400 });
	}

	const startedAt = performance.now();
	const open = await isMinecraftServerReachable(parsed.host, parsed.port);
	const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));

	return NextResponse.json({
		ok: true,
		open,
		latencyMs,
		normalizedAddress: parsed.normalizedAddress,
	});
}
