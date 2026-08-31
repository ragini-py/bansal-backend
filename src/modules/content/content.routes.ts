import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as contentController from "./content.controller.js";
import { updateContentSchema } from "./content.schemas.js";

export const contentRouter = Router();

// Public — the homepage and navbar read this without signing in.
contentRouter.get("/", contentController.get);
contentRouter.patch(
  "/",
  authenticate,
  authorize("admin"),
  validate(updateContentSchema),
  contentController.update,
);
