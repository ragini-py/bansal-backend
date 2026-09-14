import type { RequestMeta } from "../../common/request-meta.js";
import { AuditLog } from "./models/audit-log.model.js";
import type { ListAuditLogsQuery } from "./audit.schemas.js";

export interface AuditActor extends RequestMeta {
  id: string;
}

export interface RecordAuditInput {
  actor: AuditActor;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}

// Called from services after a mutation has already succeeded — a failure
// writing the audit trail must never undo or fail the business operation it
// describes, so this swallows its own errors (logged, not thrown).
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await AuditLog.create({
      actorId: input.actor.id,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: input.before ?? null,
      after: input.after ?? null,
      ip: input.actor.ip ?? null,
      userAgent: input.actor.userAgent ?? null,
    });
  } catch (err) {
    console.error("Failed to write audit log:", err);
  }
}

export interface PublicAuditLog {
  id: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  logs: PublicAuditLog[];
  total: number;
  page: number;
  limit: number;
}

export async function listAuditLogs(query: ListAuditLogsQuery): Promise<AuditLogPage> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const filter: Record<string, string> = {};
  if (query.entity) filter.entity = query.entity;
  if (query.entityId) filter.entityId = query.entityId;
  if (query.actorId) filter.actorId = query.actorId;

  const [docs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return {
    logs: docs.map((d) => ({
      id: d._id.toString(),
      actorId: d.actorId,
      action: d.action,
      entity: d.entity,
      entityId: d.entityId,
      before: d.before,
      after: d.after,
      ip: d.ip ?? null,
      userAgent: d.userAgent ?? null,
      createdAt: d.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
  };
}
