import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as catalogController from "./catalog.controller.js";
import { collectionSchema, createProductSchema, updateProductSchema } from "./catalog.schemas.js";

export const catalogRouter = Router();

// Public reads — the storefront fetches the full catalog once and filters/
// sorts client-side (see ProductsPage.tsx), matching the app's existing
// single-fetch pattern rather than a paginated/filtered API.
catalogRouter.get("/products", catalogController.listProducts);
catalogRouter.get("/products/:slug", catalogController.getProduct);
catalogRouter.get("/collections", catalogController.listCollections);
catalogRouter.get("/collections/:slug", catalogController.getCollection);

// Admin write — full CRUD, backing AdminPage's product create/edit/delete
// and collections management.
catalogRouter.post(
  "/products",
  authenticate,
  authorize("admin"),
  validate(createProductSchema),
  catalogController.createProduct,
);
catalogRouter.put(
  "/products/:id",
  authenticate,
  authorize("admin"),
  validate(updateProductSchema),
  catalogController.updateProduct,
);
catalogRouter.delete(
  "/products/:id",
  authenticate,
  authorize("admin"),
  catalogController.deleteProduct,
);

catalogRouter.post(
  "/collections",
  authenticate,
  authorize("admin"),
  validate(collectionSchema),
  catalogController.createCollection,
);
catalogRouter.put(
  "/collections/:id",
  authenticate,
  authorize("admin"),
  validate(collectionSchema),
  catalogController.updateCollection,
);
catalogRouter.delete(
  "/collections/:id",
  authenticate,
  authorize("admin"),
  catalogController.deleteCollection,
);
