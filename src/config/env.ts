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

  // Image storage — optional. Unset means "not configured yet": uploads
  // fall back to local disk (see modules/uploads) so the feature works out
  // of the box in dev; set all three to switch to Cloudinary with zero
  // code changes.
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Transactional email — optional. Unset means emails are logged to the
  // console instead of sent (see utils/email.ts); set all of these to
  // switch to real delivery through any SMTP provider (Postmark, SES,
  // Mailgun, Gmail, etc. all speak SMTP) with zero code changes.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  EMAIL_FROM: z.string().optional(),
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
  // CORS_ORIGIN may be a comma-separated allowlist (e.g. a staging + prod
  // domain). corsOrigin stays the single first entry for building outbound
  // links (email templates); corsOrigins is the full list the CORS
  // middleware actually checks incoming requests against.
  corsOrigin: parsed.data.CORS_ORIGIN.split(",")[0].trim(),
  corsOrigins: parsed.data.CORS_ORIGIN.split(",").map((o) => o.trim()),
  mongoUri: parsed.data.MONGODB_URI,
  jwt: {
    accessSecret: parsed.data.JWT_ACCESS_SECRET,
    accessTtl: parsed.data.JWT_ACCESS_TTL,
  },
  refreshTokenTtlMs: parsed.data.REFRESH_TOKEN_TTL_MS,
  passwordResetTtlMs: parsed.data.PASSWORD_RESET_TTL_MS,
  cloudinary:
    parsed.data.CLOUDINARY_CLOUD_NAME && parsed.data.CLOUDINARY_API_KEY && parsed.data.CLOUDINARY_API_SECRET
      ? {
          cloudName: parsed.data.CLOUDINARY_CLOUD_NAME,
          apiKey: parsed.data.CLOUDINARY_API_KEY,
          apiSecret: parsed.data.CLOUDINARY_API_SECRET,
        }
      : null,
  smtp:
    parsed.data.SMTP_HOST && parsed.data.SMTP_USER && parsed.data.SMTP_PASS
      ? {
          host: parsed.data.SMTP_HOST,
          port: parsed.data.SMTP_PORT ?? 587,
          secure: parsed.data.SMTP_SECURE ?? false,
          user: parsed.data.SMTP_USER,
          pass: parsed.data.SMTP_PASS,
          from: parsed.data.EMAIL_FROM ?? parsed.data.SMTP_USER,
        }
      : null,
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
    resetPasswordMax: isTest ? 10_000 : 10,
    // Guest order tracking requires id + email together, but is still
    // unauthenticated — rate-limited to slow down brute-forcing that pair.
    trackOrderMax: isTest ? 10_000 : 20,
    // Authenticated, but still throttled — checkout touches coupon codes and
    // Order.create, so an unthrottled loop could brute-force coupon codes or
    // hammer the DB with junk orders.
    orderCreateMax: isTest ? 10_000 : 30,
  },
};
