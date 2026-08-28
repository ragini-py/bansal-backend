import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as ordersController from "./orders.controller.js";
import { createOrderSchema, requestReturnSchema, updateOrderSchema } from "./orders.schemas.js";

// Mounted at /api/orders (see app.ts) — NOT bare /api, so `.use(authenticate)`
// below only ever applies to this router's own requests. A blanket `.use()`
// on a router mounted at a prefix shared with sibling routers (e.g. bare
// "/api") would intercept every request that reaches it regardless of
// whether a route further down actually matches.
export const ordersRouter = Router();

// Public guest lookup — matches TrackPage.tsx, which is reachable without
// signing in ("track your order" by id + optional email).
ordersRouter.get("/track", ordersController.track);

ordersRouter.use(authenticate);
ordersRouter.post("/", validate(createOrderSchema), ordersController.create);
ordersRouter.get("/mine", ordersController.listMine);
ordersRouter.post("/:id/return", validate(requestReturnSchema), ordersController.requestReturn);

ordersRouter.get("/", authorize("admin"), ordersController.listAll);
ordersRouter.patch("/:id", authorize("admin"), validate(updateOrderSchema), ordersController.update);
