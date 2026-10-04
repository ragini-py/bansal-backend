import { z } from "zod";

// Field-for-field match with the frontend's zod schemas
// (bansalnx-regal-suite/src/pages/{Login,Register}Page.tsx) — keep these in
// sync if either side changes.

export const registerSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(10).max(15),
  password: z.string().min(8),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// Matches ResetPasswordPage.tsx's schema (password min length + confirm-match).
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

