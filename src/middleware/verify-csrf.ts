import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../common/app-error.js";
import { REFRESH_COOKIE_NAME } from "../utils/cookies.js";
import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "../utils/csrf.js";

// Only mounted on /api/auth/refresh and /api/auth/logout — the two routes
// that authenticate purely off the httpOnly refresh cookie, which a
// cross-site request can trigger the browser into sending automatically.
// Every other mutating route requires a Bearer access token instead, which
// lives in JS memory on the legitimate origin only and can't be forged this
// way, so this check isn't needed there.
//
// Skipped entirely when there's no refresh cookie at all — there's no
// session to protect, and the controller's own "no refresh token" check
// already reports that case as 401 rather than this middleware masking it
// as a 403.
export function verifyCsrf(req: Request, _res: Response, next: NextFunction): void {
  if (!req.cookies?.[REFRESH_COOKIE_NAME]) return next();

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME] as string | undefined;
  const headerToken = req.header(CSRF_HEADER_NAME);
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw new ForbiddenError("Missing or invalid CSRF token.");
  }
  next();
}
