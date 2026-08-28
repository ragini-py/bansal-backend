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
  active: z.boolean(),
});
export type CreateCouponInput = z.infer<typeof createCouponSchema>;
