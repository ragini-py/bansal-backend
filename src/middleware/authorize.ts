import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../common/app-error.js";
import type { Role } from "../constants/roles.js";

// Access control gate #2: role-based, layered on top of `authenticate`.
// Usage: router.get("/admin/x", authenticate, authorize("admin"), handler)
export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
