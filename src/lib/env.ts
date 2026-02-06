import { z } from 'zod';

const envSchema = z.object({
  // SQLite connection string
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

// Validate process.env
const env = envSchema.parse(process.env);

export default env;
