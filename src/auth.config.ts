import NextAuth, { type NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
	providers: [],
	callbacks: {
		authorized({ auth, request: { nextUrl } }) {
			const isLoggedIn = !!auth?.user;
			const { pathname } = nextUrl;

			const protectedRoutes = ["/admin", "/profile"];
			const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

			if (isProtectedRoute) {
				if (isLoggedIn) return true;
				return false;
			}
			return true;
		},
	},
	pages: {
		signIn: "/login",
		error: "/auth/error",
	},
};

export const { auth } = NextAuth(authConfig);
