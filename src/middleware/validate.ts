import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

// Generic request-body validator — reused across every module instead of
// each route hand-rolling its own parsing. Errors are ZodErrors, caught by
// the central errorHandler, so this stays a one-liner per route:
// `router.post("/x", validate(schema), handler)`.
export function validate(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}

// Same idea, for query strings (?page=1&limit=24&...) — kept separate from
// `validate` because req.query is a different property with different
// typing (ParsedQs), and coercing/parsing it needs its own assignment.
//
// Express 5 exposes `req.query` as a getter-only accessor on the prototype
// (no setter), so a plain `req.query = ...` throws "Cannot set property
// query of #<IncomingMessage> which has only a getter" — it never reaches
// the route handler, it 500s. Object.defineProperty shadows that inherited
// getter with a real, writable own property on this request instance.
export function validateQuery(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const parsed = schema.parse(req.query);
    Object.defineProperty(req, "query", {
      value: parsed,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    next();
  };
}
