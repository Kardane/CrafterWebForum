import { NextRequest, NextResponse } from "next/server";
import { enforceRateLimitAsync } from "@/lib/rate-limit";
import { RATE_LIMIT_POLICIES } from "@/lib/rate-limit-policies";
import { buildLinkPreview, isBlockedLinkPreviewHost } from "@/lib/link-preview/providers";
import { getCachedLinkPreview, setCachedLinkPreview } from "@/lib/link-preview/cache";
import { createServerTimingHeader } from "@/lib/server-timing";
import { assertSafeHttpUrl } from "@/lib/network-guard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	try {
		const requestStart = performance.now();
		const rateLimitedResponse = await enforceRateLimitAsync(request, RATE_LIMIT_POLICIES.linkPreview);
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
		try {
			await assertSafeHttpUrl(parsedUrl);
		} catch {
			return NextResponse.json({ error: "invalid_request" }, { status: 400 });
		}

		const normalizedUrl = parsedUrl.toString();
		const cacheLookupStart = performance.now();
		const cachedPreview = getCachedLinkPreview(normalizedUrl);
		const cacheLookupDuration = performance.now() - cacheLookupStart;
		if (cachedPreview) {
			return NextResponse.json(
				{ preview: cachedPreview },
				{
					status: 200,
					headers: {
						"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
						"Server-Timing": createServerTimingHeader([
							{ name: "link_preview_cache", duration: cacheLookupDuration, description: "cache hit" },
							{ name: "link_preview_total", duration: performance.now() - requestStart },
						]),
					},
				}
			);
		}

		const buildPreviewStart = performance.now();
		const preview = await buildLinkPreview(parsedUrl);
		const buildPreviewDuration = performance.now() - buildPreviewStart;
		setCachedLinkPreview(normalizedUrl, preview);

		return NextResponse.json(
			{ preview },
			{
				status: 200,
				headers: {
					"Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
					"Server-Timing": createServerTimingHeader([
						{ name: "link_preview_cache", duration: cacheLookupDuration, description: "cache miss" },
						{ name: "link_preview_build", duration: buildPreviewDuration },
						{ name: "link_preview_total", duration: performance.now() - requestStart },
					]),
				},
			}
		);
	} catch (error) {
		console.error("[API] GET /api/link-preview error:", error);
		return NextResponse.json({ error: "internal_server_error" }, { status: 500 });
	}
}
