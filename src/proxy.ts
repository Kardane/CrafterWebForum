import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth.config";
import { isPrivilegedNickname } from "@/config/admin-policy";

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	if (pathname === "/post" || pathname === "/post/") {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = "/";
		return NextResponse.redirect(redirectUrl, 308);
	}

	if (pathname.startsWith("/post/")) {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = pathname.replace(/^\/post\//, "/posts/");
		return NextResponse.redirect(redirectUrl, 308);
	}

	const protectedRoutes = ["/admin", "/profile"];
	const adminRoutes = ["/admin"];

	const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
	const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));
	if (!isProtectedRoute && !isAdminRoute) {
		return NextResponse.next();
	}

	const session = await auth();

	if (isProtectedRoute && !session?.user) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(loginUrl);
	}

	if (isAdminRoute && session?.user) {
		const role = (session.user as { role?: string }).role;
		const nickname = (session.user as { nickname?: string }).nickname;
		if (!role && !nickname) {
			return NextResponse.next();
		}
		const hasAdminRole = role === "admin";
		const hasPrivilegedNickname = isPrivilegedNickname(nickname);
		if (!hasAdminRole && !hasPrivilegedNickname) {
			return NextResponse.json(
				{ error: "Forbidden: Admin access required" },
				{ status: 403 }
			);
		}
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
