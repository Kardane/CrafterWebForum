import type { DefaultSession } from "next-auth";

declare module "next-auth" {
	interface Session {
		user: {
			id: number;
			nickname: string;
			role: string;
			isApproved: number;
			minecraftUuid: string | null;
		} & DefaultSession["user"];
	}

	interface User {
		id: number;
		email: string;
		nickname: string;
		role: string;
		isApproved: number;
		minecraftUuid: string | null;
	}
}

declare module "next-auth/jwt" {
	interface JWT {
		id: number;
		nickname: string;
		role: string;
		isApproved: number;
		minecraftUuid: string | null;
	}
}

export {};
