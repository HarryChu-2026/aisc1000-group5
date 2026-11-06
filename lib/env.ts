import "server-only";
import { z } from "zod";

const required = z.string().trim().min(1);
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required,
  SUPABASE_SERVICE_ROLE_KEY: required,
  GOOGLE_CLIENT_ID: required,
  GOOGLE_CLIENT_SECRET: required,
  GOOGLE_REDIRECT_URI: z.string().url(),
  APP_URL: z.string().url(),
  TOKEN_ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  OPENAI_API_KEY: required,
  CRON_SECRET: required,
  OPENAI_MODEL_EXTRACT: required.default("gpt-4.1-mini"),
  OPENAI_MODEL_TRIAGE: required.default("gpt-4.1-nano"),
  MAX_DAILY_EXTRACTIONS: z.coerce.number().int().positive().default(60),
});

export function readEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const keys = [...new Set(result.error.issues.map(issue => issue.path.join(".")))];
    throw new Error(`Invalid environment configuration: ${keys.join(", ")}`);
  }
  return result.data;
}
