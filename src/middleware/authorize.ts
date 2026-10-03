import type { NextFunction, Request, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../common/app-error.js";
import type { Role } from "../constants/roles.js";
import { User } from "../modules/auth/models/index.js";

// Access control gate #2: role-based, layered on top of `authenticate`.
// Usage: router.get("/admin/x", authenticate, authorize("admin"), handler)
export function authorize(...allowedRoles: Role[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError());
      return;
    }

    // For admin-protected routes, verify live user status and role in DB
    // to prevent demoted or blocked admins from exploiting the 15-minute JWT window.
    if (allowedRoles.includes("admin")) {
      try {
        const liveUser = await User.findById(req.user.sub).select("role status");
        if (!liveUser || liveUser.status === "blocked" || !allowedRoles.includes(liveUser.role)) {
          next(new ForbiddenError("Access revoked."));
          return;
        }
      } catch (err) {
        next(err);
        return;
      }
    }

    next();
  };
}

