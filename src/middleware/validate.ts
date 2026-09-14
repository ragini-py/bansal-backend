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
export function validateQuery(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.query = schema.parse(req.query) as typeof req.query;
    next();
  };
}
