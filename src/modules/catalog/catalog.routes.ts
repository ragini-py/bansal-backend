import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate, validateQuery } from "../../middleware/validate.js";
import * as catalogController from "./catalog.controller.js";
import {
  collectionSchema,
  createCategorySchema,
  createProductSchema,
  listProductsQuerySchema,
  updateCategorySchema,
  updateProductSchema,
} from "./catalog.schemas.js";

export const catalogRouter = Router();

// Public reads. GET /products supports page/limit/category/collection/
// search/published query params for a real server-side paginated/filtered
// fetch — with none of them set, it still returns the full catalog (the
// storefront's current single-fetch-then-client-filter pattern, see
// ProductsPage.tsx, keeps working unchanged against the same endpoint).
catalogRouter.get(
  "/products",
  optionalAuthenticate,
  validateQuery(listProductsQuerySchema),
  catalogController.listProducts,
);
catalogRouter.get("/products/:slug", catalogController.getProduct);
catalogRouter.get("/collections", catalogController.listCollections);
catalogRouter.get("/collections/:slug", catalogController.getCollection);
catalogRouter.get("/categories", catalogController.listCategories);

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

catalogRouter.post(
  "/categories",
  authenticate,
  authorize("admin"),
  validate(createCategorySchema),
  catalogController.createCategory,
);
catalogRouter.put(
  "/categories/:id",
  authenticate,
  authorize("admin"),
  validate(updateCategorySchema),
  catalogController.updateCategory,
);
catalogRouter.delete(
  "/categories/:id",
  authenticate,
  authorize("admin"),
  catalogController.deleteCategory,
);

