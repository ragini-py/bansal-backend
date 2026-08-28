import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { Role } from "../constants/roles.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

// Refresh tokens are NOT JWTs — see modules/auth/models/session.model.ts and
// utils/random-token.ts. An opaque, DB-backed token is what makes
// logout/theft actually revocable; a signed refresh JWT can't be invalidated
// before it expires no matter what the server does.
export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwt.accessSecret, { expiresIn: env.jwt.accessTtl as jwt.SignOptions["expiresIn"] });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
}
