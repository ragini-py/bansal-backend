import { randomBytes } from "node:crypto";
import type { Response } from "express";
import { env } from "../config/env.js";

export const CSRF_COOKIE_NAME = "csrfToken";
export const CSRF_HEADER_NAME = "x-csrf-token";

// Double-submit pattern: the server hands the same random value to the
// client two ways — a cookie (so it round-trips automatically) and the JSON
// response body (so the frontend can send it back explicitly as a header,
// which still works even if a future cross-domain deployment puts the
// cookie's Domain out of reach of the frontend's own document.cookie).
// verify-csrf.ts then only needs the two to match; a cross-site attacker can
// trigger the cookie to be sent, but can't read its value to also set the
// header — while the browser's SameSite=lax handling gives independent
// protection against cross-site POST, this doesn't depend on it.
export function setCsrfCookie(res: Response): string {
  const token = randomBytes(32).toString("base64url");
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: env.refreshTokenTtlMs,
  });
  return token;
}

export function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    path: "/",
    secure: env.isProduction,
    sameSite: "lax",
  });
}
