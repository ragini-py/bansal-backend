import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { limiter } from "../../middleware/rate-limit.js";
import { validate } from "../../middleware/validate.js";
import { verifyCsrf } from "../../middleware/verify-csrf.js";
import { env } from "../../config/env.js";
import * as authController from "./auth.controller.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from "./auth.schemas.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  limiter(env.rateLimit.registerMax, 60 * 60 * 1000, "Too many registration attempts. Please try again later."),
  validate(registerSchema),
  authController.register,
);

authRouter.post(
  "/verify-email",
  limiter(env.rateLimit.verifyEmailMax, 60 * 60 * 1000, "Too many verification attempts. Please try again later."),
  validate(verifyEmailSchema),
  authController.verifyEmail,
);

authRouter.post(
  "/resend-verification",
  limiter(env.rateLimit.resendVerificationMax, 60 * 60 * 1000, "Too many requests. Please try again later."),
  validate(resendVerificationSchema),
  authController.resendVerification,
);

authRouter.post(
  "/login",
  limiter(env.rateLimit.loginMax, 15 * 60 * 1000, "Too many login attempts. Please try again in 15 minutes."),
  validate(loginSchema),
  authController.login,
);

authRouter.post("/refresh", verifyCsrf, authController.refresh);
authRouter.post("/logout", verifyCsrf, authController.logout);
authRouter.get("/me", authenticate, authController.me);

authRouter.post(
  "/forgot-password",
  limiter(env.rateLimit.forgotPasswordMax, 60 * 60 * 1000, "Too many reset requests. Please try again later."),
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);
authRouter.post(
  "/reset-password",
  limiter(env.rateLimit.resetPasswordMax, 60 * 60 * 1000, "Too many attempts. Please try again later."),
  validate(resetPasswordSchema),
  authController.resetPassword,
);

authRouter.post(
  "/change-password",
  authenticate,
  limiter(env.rateLimit.changePasswordMax, 60 * 60 * 1000, "Too many attempts. Please try again later."),
  validate(changePasswordSchema),
  authController.changePassword,
);
authRouter.post("/logout-all", authenticate, authController.logoutAll);
