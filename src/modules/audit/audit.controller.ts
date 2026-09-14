import type { Request, Response } from "express";
import * as auditService from "./audit.service.js";
import type { ListAuditLogsQuery } from "./audit.schemas.js";

export async function list(req: Request, res: Response): Promise<void> {
  const result = await auditService.listAuditLogs(req.query as unknown as ListAuditLogsQuery);
  res.json(result);
}
