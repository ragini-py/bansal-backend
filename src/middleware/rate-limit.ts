import rateLimit from "express-rate-limit";

// Exported as its own factory (not inlined in auth.routes.ts) so it can be
// unit-tested in isolation with an explicit tiny limit — see
// test/rate-limit.test.ts — without needing to exhaust the real, shared
// production limiter that auth.routes.ts's login/register routes use across
// every other test in the suite.
export function limiter(limit: number, windowMs: number, message: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code: "RATE_LIMITED", message },
  });
}
