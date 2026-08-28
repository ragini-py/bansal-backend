import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../common/app-error.js";
import { verifyAccessToken } from "../utils/jwt.js";

// Access control gate #1: proves the request carries a valid, unexpired
// access token and attaches the decoded payload to req.user. Expects
// `Authorization: Bearer <accessToken>` — the access token itself is never
// stored in a cookie (only the refresh token is), so it isn't vulnerable to
// CSRF and the frontend is expected to hold it in memory.
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    next(new UnauthorizedError("Missing access token."));
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError("Access token expired."));
      return;
    }
    next(new UnauthorizedError("Invalid access token."));
  }
}
