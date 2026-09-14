import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validateQuery } from "../../middleware/validate.js";
import * as auditController from "./audit.controller.js";
import { listAuditLogsQuerySchema } from "./audit.schemas.js";

export const auditRouter = Router();

// Admin-only — the audit trail itself is consequential-action history
// (order status/refund changes, blocking, deletes, coupon/settings/role
// changes), never customer-facing.
auditRouter.get(
  "/",
  authenticate,
  authorize("admin"),
  validateQuery(listAuditLogsQuerySchema),
  auditController.list,
);
