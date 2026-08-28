import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const couponSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true, uppercase: true },
    type: { type: String, enum: ["percent", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },
    minOrder: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: null },
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    usageLimit: { type: Number, default: null },
    perUserLimit: { type: Number, default: null },
    newCustomerOnly: { type: Boolean, default: false },
    restrictedCollections: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    timesUsed: { type: Number, default: 0 },
  },
  { timestamps: false },
);

export type CouponDoc = HydratedDocument<InferSchemaType<typeof couponSchema>>;

export const Coupon = model("Coupon", couponSchema);
