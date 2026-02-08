import { z } from 'zod';
import { isTursoDatabaseUrl } from "@/lib/database-url";

const envSchema = z.object({
  // 데이터베이스 연결 문자열
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // Turso 인증 토큰 (Turso 사용 시 필수)
  TURSO_AUTH_TOKEN: z.string().min(1, "TURSO_AUTH_TOKEN is required").optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
}).superRefine((value, ctx) => {
  if (isTursoDatabaseUrl(value.DATABASE_URL) && !value.TURSO_AUTH_TOKEN) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "TURSO_AUTH_TOKEN is required when DATABASE_URL is Turso URL",
      path: ["TURSO_AUTH_TOKEN"],
    });
  }
});

// Validate process.env
const env = envSchema.parse(process.env);

export default env;
