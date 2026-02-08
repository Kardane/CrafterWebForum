import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/auth.config";
import { isPrivilegedNickname } from "@/config/admin-policy";

/**
 * NextAuth.js 미들웨어
 * 보호된 라우트에 대한 인증 및 권한 검증
 */
export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// 구 라우트(/post/:id) 접근 시 canonical 경로(/posts/:id)로 강제 이동
	if (pathname.startsWith("/post/")) {
		const redirectUrl = request.nextUrl.clone();
		redirectUrl.pathname = pathname.replace(/^\/post\//, "/posts/");
		return NextResponse.redirect(redirectUrl);
	}

	const session = await auth();

	// 보호된 라우트 정의
	const protectedRoutes = ["/admin", "/profile"];
	const adminRoutes = ["/admin"];

	const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
	const isAdminRoute = adminRoutes.some((route) => pathname.startsWith(route));

	// 보호된 라우트: 로그인 필수
	if (isProtectedRoute && !session?.user) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("callbackUrl", pathname);
		return NextResponse.redirect(loginUrl);
	}

	// Admin 라우트: Admin 역할 필수
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

	// 승인되지 않은 사용자는 특정 라우트 차단 가능 (선택적)
	// if (session?.user && session.user.isApproved === 0) {
	//   const pendingUrl = new URL("/pending-approval", request.url);
	//   return NextResponse.redirect(pendingUrl);
	// }

	return NextResponse.next();
}

// 미들웨어 적용 경로 설정
export const config = {
	matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
