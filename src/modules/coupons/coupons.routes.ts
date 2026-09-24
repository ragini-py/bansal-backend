import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as couponsController from "./coupons.controller.js";
import { createCouponSchema, validateCouponSchema } from "./coupons.schemas.js";

export const couponsRouter = Router();

// Admin-only full listing — includes hidden/targeted codes, per-user limits,
// new-customer restrictions, etc. Never expose this to storefront visitors;
// that's what /coupons/public and /coupons/validate are for.
couponsRouter.get("/coupons", authenticate, authorize("admin"), couponsController.list);

// Public — only codes an admin explicitly marked isPublic, for a
// customer-facing "available offers" display (Account > Coupons).
couponsRouter.get("/coupons/public", couponsController.publicList);

// Signed-in customers check/apply a code they already know here — the
// backend re-derives eligibility and the discount amount itself so a hidden
// or targeted code is never enumerable via the coupon list.
couponsRouter.post(
  "/coupons/validate",
  authenticate,
  validate(validateCouponSchema),
  couponsController.validate,
);

couponsRouter.post(
  "/coupons",
  authenticate,
  authorize("admin"),
  validate(createCouponSchema),
  couponsController.create,
);
couponsRouter.delete("/coupons/:id", authenticate, authorize("admin"), couponsController.remove);
