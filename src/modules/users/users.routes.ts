import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { validate } from "../../middleware/validate.js";
import * as addressesController from "./addresses.controller.js";
import { createAddressSchema } from "./addresses.schemas.js";
import * as adminUsersController from "./admin-users.controller.js";
import { updateUserSchema } from "./admin-users.schemas.js";

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.post("/me/addresses", validate(createAddressSchema), addressesController.create);
usersRouter.delete("/me/addresses/:id", addressesController.remove);

usersRouter.get("/", authorize("admin"), adminUsersController.list);
usersRouter.patch(
  "/:id",
  authorize("admin"),
  validate(updateUserSchema),
  adminUsersController.update,
);
