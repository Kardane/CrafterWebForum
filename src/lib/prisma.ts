import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import env from "@/lib/env";
import { isTursoDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as {
	prisma?: PrismaClient;
};

function createPrismaClient() {
	if (!isTursoDatabaseUrl(env.DATABASE_URL)) {
		return new PrismaClient();
	}

	const adapter = new PrismaLibSQL({
		url: env.DATABASE_URL,
		authToken: env.TURSO_AUTH_TOKEN,
	});
	return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
