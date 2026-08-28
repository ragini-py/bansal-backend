import { randomBytes, createHash } from "node:crypto";

// Opaque tokens (refresh tokens today; email-verification/password-reset
// links when those are built) — the raw value goes to the client, only its
// hash is ever persisted, same reasoning as password hashing: a DB leak
// shouldn't hand out usable tokens.
export function generateOpaqueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
