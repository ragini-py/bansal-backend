import type { NextFunction, Request, Response } from "express";

// Strips any object key that starts with "$" or contains "." from
// req.body/params/query — the classic NoSQL-injection vector where a client
// sends e.g. { "email": { "$gt": "" } } instead of a string, hoping a
// downstream Mongo query treats it as an operator. Zod already rejects most
// of these today (a `z.string()` field fails validation on an object), but
// this is defense-in-depth for any field that isn't strictly typed, and for
// any query/route added later without validation.
//
// Mutates objects in place rather than reassigning req.query/req.body —
// Express 5 makes req.query a getter with no setter, so `req.query = x`
// throws; in-place mutation of the object it returns works on both Express 4
// and 5.
function sanitize(value: unknown): void {
  if (value === null || typeof value !== "object") return;

  if (Array.isArray(value)) {
    for (const item of value) sanitize(item);
    return;
  }

  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete obj[key];
      continue;
    }
    sanitize(obj[key]);
  }
}

export function sanitizeMongo(req: Request, _res: Response, next: NextFunction): void {
  sanitize(req.body);
  sanitize(req.params);
  sanitize(req.query);
  next();
}
