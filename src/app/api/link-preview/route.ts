import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";
import { buildLinkPreview, isBlockedLinkPreviewHost } from "@/lib/link-preview/providers";
import { getCachedLinkPreview, setCachedLinkPreview } from "@/lib/link-preview/cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	try {
		const rateLimitedResponse = enforceRateLimit(request, RATE_LIMIT_POLICIES.linkPreview);
		if (rateLimitedResponse) {
			return rateLimitedResponse;
		}

		const rawUrl = request.nextUrl.searchParams.get("url")?.trim() ?? "";
		if (!rawUrl || rawUrl.length > 2048) {
			return NextResponse.json({ error: "invalid_request" }, { status: 400 });
		}

		let parsedUrl: URL;
		try {
			parsedUrl = new URL(rawUrl);
		} catch {
			return NextResponse.json({ error: "invalid_request" }, { status: 400 });
		}

		if (!["http:", "https:"].includes(parsedUrl.protocol)) {
			return NextResponse.json({ error: "invalid_request" }, { status: 400 });
		}

		if (isBlockedLinkPreviewHost(parsedUrl.hostname)) {
			return NextResponse.json({ error: "invalid_request" }, { status: 400 });
		}

		const normalizedUrl = parsedUrl.toString();
		const cachedPreview = getCachedLinkPreview(normalizedUrl);
		if (cachedPreview) {
			return NextResponse.json(
				{ preview: cachedPreview },
				{
					status: 200,
					headers: {
						"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
					},
				}
			);
		}

		const preview = await buildLinkPreview(parsedUrl);
		setCachedLinkPreview(normalizedUrl, preview);

		return NextResponse.json(
			{ preview },
			{
				status: 200,
				headers: {
					"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
				},
			}
		);
	} catch (error) {
		console.error("[API] GET /api/link-preview error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
