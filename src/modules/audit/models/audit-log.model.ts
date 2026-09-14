import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Append-only trail for admin-consequential actions — order status/refund
// changes, customer blocking, product deletion, coupon create/delete,
// settings changes, role changes. Never updated or deleted once written;
// `before`/`after` are loose snapshots (Mixed) rather than typed per-entity
// so one collection can log every entity without a schema per action type.
const auditLogSchema = new Schema(
  {
    actorId: { type: String, required: true, index: true },
    // Dot-separated "<entity>.<verb>", e.g. "order.status_changed",
    // "product.deleted", "coupon.created" — see audit.service.ts's callers
    // for the exact set in use.
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Admin audit view filters/sorts by entity+time far more often than by
// actor alone — a compound index matches that access pattern directly.
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export type AuditLogDoc = HydratedDocument<InferSchemaType<typeof auditLogSchema>>;

export const AuditLog = model("AuditLog", auditLogSchema);
