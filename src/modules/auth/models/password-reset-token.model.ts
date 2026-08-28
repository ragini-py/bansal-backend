import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const passwordResetTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Never stored raw — same reasoning as the refresh token in session.model.ts.
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Native MongoDB TTL index — auto-deleted once expiresAt passes.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type PasswordResetTokenDoc = HydratedDocument<InferSchemaType<typeof passwordResetTokenSchema>>;

export const PasswordResetToken = model("PasswordResetToken", passwordResetTokenSchema);
