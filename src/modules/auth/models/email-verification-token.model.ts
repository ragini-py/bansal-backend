import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const emailVerificationTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// Native MongoDB TTL index — auto-deleted once expiresAt passes.
emailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type EmailVerificationTokenDoc = HydratedDocument<
  InferSchemaType<typeof emailVerificationTokenSchema>
>;

export const EmailVerificationToken = model(
  "EmailVerificationToken",
  emailVerificationTokenSchema,
);
