import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { ROLES } from "../../../constants/roles.js";
import { addressSchema } from "./address.schema.js";

const USER_STATUSES = ["active", "blocked"] as const;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false — never returned by default; auth.service.ts must
    // explicitly .select("+passwordHash") when it actually needs to compare it.
    // Optional for users who registered/signed in via Google OAuth.
    passwordHash: { type: String, required: false, select: false, default: null },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: false, trim: true, default: "" },
    phone: { type: String, required: false, trim: true, default: "" },
    role: { type: String, enum: ROLES, default: "customer" },
    status: { type: String, enum: USER_STATUSES, default: "active" },
    googleId: { type: String, default: null, sparse: true, index: true },
    avatar: { type: String, default: null },
    authProvider: { type: String, enum: ["local", "google"], default: "local" },
    isEmailVerified: { type: Boolean, default: false },
    emailVerifiedAt: { type: Date, default: null },
    addresses: { type: [addressSchema], default: [] },
  },
  { timestamps: true },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const User = model("User", userSchema);
