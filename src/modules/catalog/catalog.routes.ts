import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as catalogController from "./catalog.controller.js";
import { updateProductSchema } from "./catalog.schemas.js";

export const catalogRouter = Router();

// Public reads — the storefront fetches the full catalog once and filters/
// sorts client-side (see ProductsPage.tsx), matching the app's existing
// single-fetch pattern rather than a paginated/filtered API.
catalogRouter.get("/products", catalogController.listProducts);
catalogRouter.get("/products/:slug", catalogController.getProduct);
catalogRouter.get("/collections", catalogController.listCollections);
catalogRouter.get("/collections/:slug", catalogController.getCollection);

// Admin write — only what AdminPage's ProductsManagerTab actually does today
// (toggle published, edit price), sent as a full product replace. No
// create/delete routes yet: nothing in the UI calls them.
catalogRouter.put(
  "/products/:id",
  authenticate,
  authorize("admin"),
  validate(updateProductSchema),
  catalogController.updateProduct,
);
