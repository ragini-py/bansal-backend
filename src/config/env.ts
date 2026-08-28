import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().min(1),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_MS: z.coerce.number().default(7 * 24 * 60 * 60 * 1000),
  PASSWORD_RESET_TTL_MS: z.coerce.number().default(30 * 60 * 1000),
  // No default — every environment must state its own URL explicitly,
  // rather than silently falling back to a dev value that would be wrong
  // in staging/prod.
  APP_URL: z.string().min(1),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration — check your .env against .env.example");
}

const isTest = parsed.data.NODE_ENV === "test";

export const env = {
  port: parsed.data.PORT,
  nodeEnv: parsed.data.NODE_ENV,
  isProduction: parsed.data.NODE_ENV === "production",
  appUrl: parsed.data.APP_URL,
  corsOrigin: parsed.data.CORS_ORIGIN,
  mongoUri: parsed.data.MONGODB_URI,
  jwt: {
    accessSecret: parsed.data.JWT_ACCESS_SECRET,
    accessTtl: parsed.data.JWT_ACCESS_TTL,
  },
  refreshTokenTtlMs: parsed.data.REFRESH_TOKEN_TTL_MS,
  passwordResetTtlMs: parsed.data.PASSWORD_RESET_TTL_MS,
  // Real limits in dev/prod. In test, a single process runs many unrelated
  // functional tests against the same login/register routes in sequence —
  // sharing one process-lifetime limiter would make them trip each other's
  // budget. The rate-limiting *mechanism* itself is still verified, just
  // against an isolated instance with an explicit tiny limit — see
  // test/rate-limit.test.ts.
  rateLimit: {
    loginMax: isTest ? 10_000 : 5,
    registerMax: isTest ? 10_000 : 5,
    forgotPasswordMax: isTest ? 10_000 : 5,
    // Guest order tracking requires id + email together, but is still
    // unauthenticated — rate-limited to slow down brute-forcing that pair.
    trackOrderMax: isTest ? 10_000 : 20,
  },
};
