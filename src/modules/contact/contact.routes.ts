import { Router } from "express";
import { env } from "../../config/env.js";
import { limiter } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import * as contactController from "./contact.controller.js";
import { submitContactSchema } from "./contact.schemas.js";

export const contactRouter = Router();

contactRouter.post(
    "/",
    limiter(env.rateLimit.contactMax, 15 * 60 * 1000, "Too many contact requests. Please try again later."),
    validate(submitContactSchema),
    contactController.submit,
);