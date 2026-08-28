import { ConflictError, NotFoundError } from "../../common/app-error.js";
import { Coupon, type CouponDoc } from "./models/coupon.model.js";
import type { CreateCouponInput } from "./coupons.schemas.js";

export interface PublicCoupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minOrder: number;
  maxDiscount: number | null;
  startsAt: string;
  expiresAt: string;
  usageLimit: number | null;
  perUserLimit: number | null;
  newCustomerOnly: boolean;
  restrictedCollections: string[];
  active: boolean;
  timesUsed: number;
}

// Matches frontend/src/data/types.ts's Coupon exactly.
export function toPublicCoupon(doc: CouponDoc): PublicCoupon {
  return {
    id: doc._id.toString(),
    code: doc.code,
    type: doc.type,
    value: doc.value,
    minOrder: doc.minOrder,
    maxDiscount: doc.maxDiscount ?? null,
    startsAt: doc.startsAt.toISOString(),
    expiresAt: doc.expiresAt.toISOString(),
    usageLimit: doc.usageLimit ?? null,
    perUserLimit: doc.perUserLimit ?? null,
    newCustomerOnly: doc.newCustomerOnly,
    restrictedCollections: doc.restrictedCollections,
    active: doc.active,
    timesUsed: doc.timesUsed,
  };
}

export async function listCoupons(): Promise<PublicCoupon[]> {
  const docs = await Coupon.find().sort({ startsAt: -1 });
  return docs.map(toPublicCoupon);
}

export async function createCoupon(input: CreateCouponInput): Promise<PublicCoupon> {
  const existing = await Coupon.findOne({ code: input.code.toUpperCase() });
  if (existing) throw new ConflictError("A coupon with this code already exists.");

  const doc = await Coupon.create(input);
  return toPublicCoupon(doc);
}

export async function deleteCoupon(id: string): Promise<void> {
  const doc = await Coupon.findByIdAndDelete(id);
  if (!doc) throw new NotFoundError("Coupon not found.");
}
