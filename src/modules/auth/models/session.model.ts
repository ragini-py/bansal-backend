import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const sessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Refresh token is never stored raw — only its hash, same reason
    // passwords aren't stored raw. See utils/random-token.ts.
    refreshTokenHash: { type: String, required: true, unique: true },
    ip: { type: String },
    userAgent: { type: String },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Native MongoDB TTL index — the document is auto-deleted once expiresAt
// passes, no scheduled cleanup job needed.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type SessionDoc = HydratedDocument<InferSchemaType<typeof sessionSchema>>;

export const Session = model("Session", sessionSchema);
