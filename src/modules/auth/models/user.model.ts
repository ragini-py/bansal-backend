import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { ROLES } from "../../../constants/roles.js";
import { addressSchema } from "./address.schema.js";

const USER_STATUSES = ["active", "blocked"] as const;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // select: false — never returned by default; auth.service.ts must
    // explicitly .select("+passwordHash") when it actually needs to compare it.
    passwordHash: { type: String, required: true, select: false },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    role: { type: String, enum: ROLES, default: "customer" },
    status: { type: String, enum: USER_STATUSES, default: "active" },
    addresses: { type: [addressSchema], default: [] },
  },
  { timestamps: true },
);

export type UserDoc = HydratedDocument<InferSchemaType<typeof userSchema>>;

export const User = model("User", userSchema);
