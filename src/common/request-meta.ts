import type { Request } from "express";

// Shared by every module that needs to know who/where a request came from —
// session issuance (auth.service.ts) and audit logging (audit.service.ts)
// both want the same {ip, userAgent} pair, so it's pulled out once here
// instead of each controller re-deriving it.
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export function requestMeta(req: Request): RequestMeta {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}
