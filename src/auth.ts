import NextAuth, { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isPrivilegedNickname } from "@/config/admin-policy";


export const authConfig: NextAuthConfig = {
	providers: [
		Credentials({
			name: "Credentials",
			credentials: {
				nickname: { label: "닉네임", type: "text" },
				password: { label: "비밀번호", type: "password" },
			},
			async authorize(credentials) {
				// 입력 검증
				if (!credentials?.nickname || !credentials?.password) {
					return null;
				}

				const nickname = credentials.nickname as string;
				const password = credentials.password as string;

				try {
					// 사용자 조회
					let user = await prisma.user.findFirst({
						where: {
							nickname,
							deletedAt: null,
						},
					});

					// 사용자 없음
					if (!user) {
						return null;
					}

					// 비밀번호 검증
					const isValidPassword = await compare(password, user.password);
					if (!isValidPassword) {
						return null;
					}

					// 이메일 미인증
					if (!user.emailVerified) {
						return null;
					}

					// 관리 닉네임 정책과 마지막 접속 시각을 한 번에 반영
					const shouldBeAdmin = isPrivilegedNickname(user.nickname);
					const updateData: { lastAuthAt: Date; role?: string; isApproved?: number } = {
						lastAuthAt: new Date(),
					};

					if (shouldBeAdmin && user.role !== "admin") {
						updateData.role = "admin";
					}

					if (shouldBeAdmin && user.isApproved !== 1) {
						updateData.isApproved = 1;
					}

					user = await prisma.user.update({
						where: { id: user.id },
						data: updateData,
					});

					// 인증 성공 - 사용자 정보 반환
					return {
						id: user.id,
						email: user.email,
						nickname: user.nickname,
						role: user.role,
						isApproved: user.isApproved,
						minecraftUuid: user.minecraftUuid,
					};
				} catch (error) {
					console.error("[Auth] Authorization error:", error);
					return null;
				}
			},
		}),
	],

	// Callbacks
	callbacks: {
		// JWT Callback: 토큰에 사용자 정보 포함
		async jwt({ token, user }) {
			if (user) {
				token.id = user.id;
				token.nickname = user.nickname;
				token.role = user.role;
				token.isApproved = user.isApproved;
				token.minecraftUuid = user.minecraftUuid;
			}
			return token;
		},

		// Session Callback: 세션에 토큰 정보 포함
		async session({ session, token }) {
			if (token && session.user) {
				return {
					...session,
					user: {
						...session.user,
						id: token.id as number,
						nickname: token.nickname as string,
						role: token.role as string,
						isApproved: token.isApproved as number,
						minecraftUuid: (token.minecraftUuid as string | null) ?? null,
					},
				};
			}
			return session;
		},
	},

	// 페이지 설정
	pages: {
		signIn: "/login",
		error: "/auth/error",
	},

	// 세션 전략 (JWT)
	session: {
		strategy: "jwt",
		maxAge: 7 * 24 * 60 * 60, // 7일
	},

	// 보안 설정
	secret: process.env.NEXTAUTH_SECRET,
};

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
