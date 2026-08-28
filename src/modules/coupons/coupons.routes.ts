import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as couponsController from "./coupons.controller.js";
import { createCouponSchema } from "./coupons.schemas.js";

export const couponsRouter = Router();

// Public read — coupon codes/terms are visible to any storefront visitor
// today (CheckoutPage/CartPage validate a code entirely client-side against
// this list), matching the existing mock behavior exactly.
couponsRouter.get("/coupons", couponsController.list);

couponsRouter.post(
  "/coupons",
  authenticate,
  authorize("admin"),
  validate(createCouponSchema),
  couponsController.create,
);
couponsRouter.delete("/coupons/:id", authenticate, authorize("admin"), couponsController.remove);
