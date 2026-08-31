import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { limiter } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { env } from "../../config/env.js";
import * as ordersController from "./orders.controller.js";
import { createOrderSchema, requestReturnSchema, updateOrderSchema } from "./orders.schemas.js";

// Mounted at /api/orders (see app.ts) — NOT bare /api, so `.use(authenticate)`
// below only ever applies to this router's own requests. A blanket `.use()`
// on a router mounted at a prefix shared with sibling routers (e.g. bare
// "/api") would intercept every request that reaches it regardless of
// whether a route further down actually matches.
export const ordersRouter = Router();

// Public guest lookup — matches TrackPage.tsx, which is reachable without
// signing in ("track your order" by id + email, both required — see
// orders.controller.ts). Rate-limited since it's unauthenticated.
ordersRouter.get(
  "/track",
  limiter(env.rateLimit.trackOrderMax, 15 * 60 * 1000, "Too many tracking attempts. Please try again in 15 minutes."),
  ordersController.track,
);

ordersRouter.use(authenticate);
ordersRouter.post(
  "/",
  limiter(env.rateLimit.orderCreateMax, 15 * 60 * 1000, "Too many order attempts. Please try again in 15 minutes."),
  validate(createOrderSchema),
  ordersController.create,
);
ordersRouter.get("/mine", ordersController.listMine);
ordersRouter.post("/:id/return", validate(requestReturnSchema), ordersController.requestReturn);
ordersRouter.post("/:id/cancel", ordersController.cancel);

ordersRouter.get("/", authorize("admin"), ordersController.listAll);
ordersRouter.patch("/:id", authorize("admin"), validate(updateOrderSchema), ordersController.update);
