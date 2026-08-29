import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as settingsController from "./settings.controller.js";
import { updateSettingsSchema } from "./settings.schemas.js";

export const settingsRouter = Router();

// Public — Footer/ContactPage/ShippingPage/TermsPage etc. all read store
// config (brand name, support contact, shipping policy) without signing in.
settingsRouter.get("/", settingsController.get);
settingsRouter.patch(
  "/",
  authenticate,
  authorize("admin"),
  validate(updateSettingsSchema),
  settingsController.update,
);
