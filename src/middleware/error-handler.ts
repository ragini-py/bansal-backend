import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../common/app-error.js";
import { env } from "../config/env.js";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ success: false, code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` });
}

// Express only recognizes this as an error-handling middleware if it takes
// exactly 4 parameters — req/next must stay even though they're unused here.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ success: false, code: err.code, message: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Invalid request.", issues: err.flatten() });
    return;
  }

  console.error(err);
  res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: env.isProduction ? "Something went wrong." : err instanceof Error ? err.message : "Unknown error",
  });
}
