import { ConflictError, NotFoundError } from "../../common/app-error.js";
import { type AuditActor, recordAudit } from "../audit/audit.service.js";
import { Product } from "../catalog/models/index.js";
import { Order } from "../orders/models/order.model.js";
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
  isPublic: boolean;
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
    isPublic: doc.isPublic,
    active: doc.active,
    timesUsed: doc.timesUsed,
  };
}

// Admin-only full listing — includes hidden/targeted codes. Never expose
// this to unauthenticated or non-admin requests (see coupons.routes.ts).
export async function listCoupons(): Promise<PublicCoupon[]> {
  const docs = await Coupon.find().sort({ startsAt: -1 });
  return docs.map(toPublicCoupon);
}

// Customer-facing listing — only codes an admin explicitly marked isPublic,
// and only while they're actually usable, so a browsable "available offers"
// list never leaks hidden/targeted codes. Anyone with a hidden code can still
// apply it via validateCouponForCart; they just won't see it listed here.
export async function listPublicCoupons(): Promise<PublicCoupon[]> {
  const now = new Date();
  const docs = await Coupon.find({
    isPublic: true,
    active: true,
    startsAt: { $lte: now },
    expiresAt: { $gte: now },
  }).sort({ startsAt: -1 });
  return docs.map(toPublicCoupon);
}

interface CouponPricingLine {
  productId: string;
  quantity: number;
}

// Coupon eligibility and discount math — the frontend calls
// validateCouponForCart (via POST /coupons/validate) for instant feedback,
// and orders.service.createOrder calls priceCoupon again right before
// charging; only that second call is ever trusted for the actual order.
export async function priceCoupon(
  code: string,
  userId: string,
  subtotal: number,
  lines: CouponPricingLine[],
): Promise<{ couponCode: string; discount: number }> {
  const coupon = await Coupon.findOne({ code: code.trim().toUpperCase() });
  if (!coupon) throw new ConflictError("That coupon code is no longer valid.");

  const now = new Date();
  if (!coupon.active) throw new ConflictError("That coupon is no longer active.");
  if (now < coupon.startsAt || now > coupon.expiresAt) {
    throw new ConflictError("That coupon isn't valid right now.");
  }
  if (subtotal < coupon.minOrder) {
    throw new ConflictError("This order no longer meets that coupon's minimum order value.");
  }
  if (coupon.usageLimit != null && coupon.timesUsed >= coupon.usageLimit) {
    throw new ConflictError("This coupon has reached its usage limit.");
  }
  if (coupon.perUserLimit != null) {
    const usedByUser = await Order.countDocuments({ userId, couponCode: coupon.code });
    if (usedByUser >= coupon.perUserLimit) {
      throw new ConflictError("You've already used this coupon the maximum number of times.");
    }
  }
  if (coupon.newCustomerOnly) {
    const hasOrders = await Order.exists({ userId });
    if (hasOrders) throw new ConflictError("This coupon is only valid for new customers.");
  }
  if (coupon.restrictedCollections.length > 0) {
    const eligible = await Product.countDocuments({
      _id: { $in: lines.map((l) => l.productId) },
      collections: { $in: coupon.restrictedCollections },
    });
    if (eligible === 0) {
      throw new ConflictError("This coupon doesn't apply to the items in your cart.");
    }
  }

  return { couponCode: coupon.code, discount: computeDiscount(coupon, subtotal) };
}

export function computeDiscount(coupon: CouponDoc, subtotal: number): number {
  let discount =
    coupon.type === "percent" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  return Math.min(discount, subtotal);
}

// Used only by the pre-checkout preview endpoint (POST /coupons/validate) —
// never trusts a client-sent subtotal, re-fetches live product prices itself.
async function computeCartSubtotal(lines: CouponPricingLine[]): Promise<number> {
  const prices = await Promise.all(
    lines.map(async (line) => {
      const product = await Product.findById(line.productId).catch(() => null);
      if (!product) throw new NotFoundError(`Product ${line.productId} no longer exists.`);
      return product.price * line.quantity;
    }),
  );
  return prices.reduce((sum, p) => sum + p, 0);
}

export async function validateCouponForCart(
  code: string,
  userId: string,
  lines: CouponPricingLine[],
): Promise<{ couponCode: string; discount: number; subtotal: number }> {
  const subtotal = await computeCartSubtotal(lines);
  const priced = await priceCoupon(code, userId, subtotal, lines);
  return { ...priced, subtotal };
}

export async function createCoupon(input: CreateCouponInput, actor: AuditActor): Promise<PublicCoupon> {
  const existing = await Coupon.findOne({ code: input.code.toUpperCase() });
  if (existing) throw new ConflictError("A coupon with this code already exists.");

  const doc = await Coupon.create(input);
  await recordAudit({
    actor,
    action: "coupon.created",
    entity: "coupon",
    entityId: doc._id.toString(),
    after: toPublicCoupon(doc),
  });
  return toPublicCoupon(doc);
}

export async function deleteCoupon(id: string, actor: AuditActor): Promise<void> {
  const doc = await Coupon.findByIdAndDelete(id);
  if (!doc) throw new NotFoundError("Coupon not found.");
  await recordAudit({
    actor,
    action: "coupon.deleted",
    entity: "coupon",
    entityId: id,
    before: toPublicCoupon(doc),
  });
}
