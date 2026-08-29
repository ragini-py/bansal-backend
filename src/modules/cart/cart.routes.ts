import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import * as cartController from "./cart.controller.js";
import { replaceCartSchema } from "./cart.schemas.js";

// Mounted at /api/cart (see app.ts) — its own prefix, not shared with any
// sibling router, so `.use(authenticate)` here only ever gates this router's
// own requests (see orders.routes.ts's comment for the bug class this avoids).
export const cartRouter = Router();

cartRouter.use(authenticate);
cartRouter.get("/", cartController.get);
cartRouter.put("/", validate(replaceCartSchema), cartController.replace);
