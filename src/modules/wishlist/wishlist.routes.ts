import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { validate } from "../../middleware/validate.js";
import * as wishlistController from "./wishlist.controller.js";
import { replaceWishlistSchema } from "./wishlist.schemas.js";

// Mounted at /api/wishlist (see app.ts) — its own prefix, so `.use(authenticate)`
// only ever gates this router's own requests (see orders.routes.ts's comment).
export const wishlistRouter = Router();

wishlistRouter.use(authenticate);
wishlistRouter.get("/", wishlistController.get);
wishlistRouter.put("/", validate(replaceWishlistSchema), wishlistController.replace);
