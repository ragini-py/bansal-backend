import type { Request, Response } from "express";
import { NotFoundError, UnauthorizedError } from "../../common/app-error.js";
import { clearRefreshCookie, REFRESH_COOKIE_NAME, setRefreshCookie } from "../../utils/cookies.js";
import type { AccessTokenPayload } from "../../utils/jwt.js";
import * as authService from "./auth.service.js";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "./auth.schemas.js";

// Thin HTTP layer only — request parsing (delegated to the `validate`
// middleware), cookies, response shaping. Business logic and every Mongo
// call live in auth.service.ts.

function requestMeta(req: Request): authService.RequestMeta {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { user, accessToken, refreshToken } = await authService.registerUser(req.body as RegisterInput, requestMeta(req));
  setRefreshCookie(res, refreshToken);
  res.status(201).json({ user, accessToken });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { user, accessToken, refreshToken } = await authService.loginUser(req.body as LoginInput, requestMeta(req));
  setRefreshCookie(res, refreshToken);
  res.json({ user, accessToken });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!token) throw new UnauthorizedError("No refresh token.");

  let tokens;
  try {
    tokens = await authService.rotateSession(token, requestMeta(req));
  } catch (err) {
    clearRefreshCookie(res);
    throw err;
  }

  setRefreshCookie(res, tokens.refreshToken);
  res.json({ accessToken: tokens.accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  await authService.revokeSession(token);
  clearRefreshCookie(res);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  // req.user is populated by the `authenticate` middleware — this route is
  // the reference example for "access control": it's unreachable without a
  // valid access token.
  const { sub } = req.user as AccessTokenPayload;
  const user = await authService.getUserById(sub);
  if (!user) throw new NotFoundError("User not found.");
  res.json({ user });
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  await authService.requestPasswordReset(req.body as ForgotPasswordInput);
  // Always 204, whether or not the email matched an account — see
  // requestPasswordReset's comment.
  res.status(204).send();
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  await authService.resetPassword(req.body as ResetPasswordInput);
  res.status(204).send();
}
