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
