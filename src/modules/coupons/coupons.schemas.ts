import { z } from "zod";

// Field-for-field match with the frontend's Coupon type
// (bansalnx-regal-suite/src/data/types.ts) minus `id`/`timesUsed`, which the
// DB assigns/tracks. Matches what AdminPage's CouponsManagerTab actually
// sends when creating a coupon.
export const createCouponSchema = z.object({
  code: z.string().trim().min(1).max(40),
  type: z.enum(["percent", "fixed"]),
  value: z.number().min(0),
  minOrder: z.number().min(0),
  maxDiscount: z.number().min(0).nullable(),
  startsAt: z.string(),
  expiresAt: z.string(),
  usageLimit: z.number().int().min(1).nullable(),
  perUserLimit: z.number().int().min(1).nullable(),
  newCustomerOnly: z.boolean(),
  restrictedCollections: z.array(z.string()),
  isPublic: z.boolean().default(false),
  active: z.boolean(),
});
export type CreateCouponInput = z.infer<typeof createCouponSchema>;

// POST /coupons/validate — the client sends only the code and cart contents
// (productId + quantity); the server looks up live product prices itself and
// re-derives eligibility/discount, so a tampered subtotal can't be sent here.
export const validateCouponSchema = z.object({
  code: z.string().trim().min(1).max(40),
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1),
});
export type ValidateCouponInput = z.infer<typeof validateCouponSchema>;
