import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

// One id per request, echoed back as X-Request-Id — lets a client or log
// line be correlated across the request/response pair and any downstream
// logs, without needing a full structured-logging setup to get the basic
// "which request was this" traceability.
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers["x-request-id"];
  const id = typeof incoming === "string" && incoming.trim() ? incoming : randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}
