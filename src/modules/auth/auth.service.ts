import { isValidObjectId } from "mongoose";
import { ConflictError, ForbiddenError, UnauthorizedError } from "../../common/app-error.js";
import { env } from "../../config/env.js";
import { sendEmail } from "../../utils/email.js";
import {
  renderEmailVerificationHtml,
  renderPasswordResetHtml,
} from "../../utils/email-templates.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { generateOpaqueToken, hashToken } from "../../utils/random-token.js";
import { signAccessToken, type AccessTokenPayload } from "../../utils/jwt.js";
import {
  EmailVerificationToken,
  PasswordResetToken,
  Session,
  User,
  type UserDoc,
} from "./models/index.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResendVerificationInput,
  ResetPasswordInput,
} from "./auth.schemas.js";

export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

export interface PublicAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  locality: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserDoc["role"];
  status: UserDoc["status"];
  isEmailVerified: boolean;
  createdAt: string;
  addresses: PublicAddress[];
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterResult {
  message: string;
  email: string;
  requiresVerification: true;
}

// Matches frontend/src/data/types.ts's User exactly, minus `password` (never
// leaves the server — passwordHash is select:false on the schema anyway,
// but this is the second, explicit line of defense).
export function toPublicUser(user: UserDoc): PublicUser {
  return {
    id: user._id.toString(),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    isEmailVerified: user.isEmailVerified ?? false,
    createdAt: user.createdAt.toISOString(),
    addresses: user.addresses.map((a) => ({
      id: a._id.toString(),
      label: a.label,
      fullName: a.fullName,
      phone: a.phone,
      line1: a.line1,
      locality: a.locality,
      city: a.city,
      state: a.state,
      pincode: a.pincode,
      country: a.country,
      isDefault: a.isDefault,
    })),
  };
}

function toAccessTokenPayload(user: UserDoc): AccessTokenPayload {
  return { sub: user._id.toString(), email: user.email, role: user.role };
}

async function issueSession(user: UserDoc, meta: RequestMeta): Promise<SessionTokens> {
  const { token, hash } = generateOpaqueToken();
  await Session.create({
    userId: user._id,
    refreshTokenHash: hash,
    ip: meta.ip,
    userAgent: meta.userAgent,
    expiresAt: new Date(Date.now() + env.refreshTokenTtlMs),
  });

  return { accessToken: signAccessToken(toAccessTokenPayload(user)), refreshToken: token };
}

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const existing = await User.findOne({ email: input.email });
  if (existing) throw new ConflictError("An account with this email already exists.");

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    isEmailVerified: false,
  });

  const { token, hash } = generateOpaqueToken();
  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + env.emailVerificationTtlMs),
  });

  const verificationUrl = `${env.corsOrigin}/verify-email?token=${token}`;
  const expiresHours = Math.round(env.emailVerificationTtlMs / (3600 * 1000));

  await sendEmail({
    to: user.email,
    subject: "Verify your email — Bansal-nx",
    text: `Hi ${user.firstName},\n\nWelcome to Bansal-nx! Please verify your email by opening the link below. It expires in ${expiresHours} hours.\n\n${verificationUrl}\n\nIf you did not create this account, you can safely ignore this email.`,
    html: renderEmailVerificationHtml({
      name: user.firstName,
      verificationUrl,
      expiresHours,
    }),
  }).catch((err: unknown) => console.error("Failed to send verification email:", err));

  return {
    message: "Registration successful. Please check your email to verify your account.",
    email: user.email,
    requiresVerification: true,
  };
}

export async function verifyEmail(
  rawToken: string,
  meta: RequestMeta,
): Promise<{ user: PublicUser } & SessionTokens> {
  const hash = hashToken(rawToken);
  const tokenDoc = await EmailVerificationToken.findOne({
    tokenHash: hash,
    expiresAt: { $gt: new Date() },
  });

  if (!tokenDoc) {
    throw new UnauthorizedError("This verification link is invalid or has expired.");
  }

  const user = await User.findById(tokenDoc.userId);
  if (!user) {
    throw new UnauthorizedError("This account no longer exists.");
  }

  user.isEmailVerified = true;
  user.emailVerifiedAt = new Date();
  await user.save();

  // Clean up any remaining verification tokens for this user
  await EmailVerificationToken.deleteMany({ userId: user._id });

  // Automatically sign the user in directly upon verification
  const tokens = await issueSession(user, meta);
  return { user: toPublicUser(user), ...tokens };
}

export async function resendVerification(input: ResendVerificationInput): Promise<void> {
  const user = await User.findOne({ email: input.email });
  // If user does not exist or is already verified, return silently (enumeration guard)
  if (!user || user.isEmailVerified) return;

  await EmailVerificationToken.deleteMany({ userId: user._id });

  const { token, hash } = generateOpaqueToken();
  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + env.emailVerificationTtlMs),
  });

  const verificationUrl = `${env.corsOrigin}/verify-email?token=${token}`;
  const expiresHours = Math.round(env.emailVerificationTtlMs / (3600 * 1000));

  await sendEmail({
    to: user.email,
    subject: "Verify your email — Bansal-nx",
    text: `Hi ${user.firstName},\n\nHere is your new verification link for Bansal-nx. It expires in ${expiresHours} hours.\n\n${verificationUrl}\n\nIf you did not request this, you can safely ignore this email.`,
    html: renderEmailVerificationHtml({
      name: user.firstName,
      verificationUrl,
      expiresHours,
    }),
  }).catch((err: unknown) => console.error("Failed to resend verification email:", err));
}

export async function loginUser(
  input: LoginInput,
  meta: RequestMeta,
): Promise<{ user: PublicUser } & SessionTokens> {
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!user || !(await comparePassword(input.password, user.passwordHash))) {
    throw new UnauthorizedError("Invalid email or password.");
  }
  if (user.status === "blocked") {
    throw new ForbiddenError("This account has been suspended. Please contact us.");
  }
  if (!user.isEmailVerified && user.role === "customer") {
    throw new ForbiddenError(
      "Please verify your email address to log in. Check your inbox for the verification link.",
    );
  }

  const tokens = await issueSession(user, meta);
  return { user: toPublicUser(user), ...tokens };
}

export async function rotateSession(
  rawRefreshToken: string,
  meta: RequestMeta,
): Promise<SessionTokens> {
  const hash = hashToken(rawRefreshToken);
  const session = await Session.findOne({ refreshTokenHash: hash });
  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid or expired refresh token.");
  }

  if (session.revokedAt) {
    await Session.updateMany({ userId: session.userId, revokedAt: null }, { revokedAt: new Date() });
    throw new UnauthorizedError("Invalid or expired refresh token.");
  }

  const user = await User.findById(session.userId);
  if (!user) {
    session.revokedAt = new Date();
    await session.save();
    throw new UnauthorizedError("Account no longer exists.");
  }
  if (user.status === "blocked") {
    session.revokedAt = new Date();
    await session.save();
    throw new ForbiddenError("This account has been suspended. Please contact us.");
  }

  session.revokedAt = new Date();
  await session.save();

  return issueSession(user, meta);
}

export async function revokeSession(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  const hash = hashToken(rawRefreshToken);
  await Session.updateOne({ refreshTokenHash: hash, revokedAt: null }, { revokedAt: new Date() });
}

export async function getUserById(id: string): Promise<PublicUser | null> {
  if (!isValidObjectId(id)) return null;
  const user = await User.findById(id);
  return user ? toPublicUser(user) : null;
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const user = await User.findOne({ email: input.email });
  if (!user) return;

  const { token, hash } = generateOpaqueToken();
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + env.passwordResetTtlMs),
  });

  const resetLink = `${env.corsOrigin}/reset-password?token=${token}`;
  const expiresMinutes = Math.round(env.passwordResetTtlMs / 60000);

  await sendEmail({
    to: user.email,
    subject: "Reset your Bansal-nx password",
    text: `Hi ${user.firstName},\n\nReset your password using the link below. It expires in ${expiresMinutes} minutes.\n\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: renderPasswordResetHtml({
      name: user.firstName,
      resetUrl: resetLink,
      expiresMinutes,
    }),
  }).catch((err: unknown) => console.error("Failed to send password reset email:", err));
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const hash = hashToken(input.token);
  const resetToken = await PasswordResetToken.findOne({
    tokenHash: hash,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!resetToken) throw new UnauthorizedError("This reset link is invalid or has expired.");

  const user = await User.findById(resetToken.userId);
  if (!user) throw new UnauthorizedError("This reset link is invalid or has expired.");

  user.passwordHash = await hashPassword(input.password);
  await user.save();

  resetToken.usedAt = new Date();
  await resetToken.save();

  await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
}

export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw new UnauthorizedError("Account no longer exists.");
  if (!(await comparePassword(input.currentPassword, user.passwordHash))) {
    throw new UnauthorizedError("Current password is incorrect.");
  }

  user.passwordHash = await hashPassword(input.newPassword);
  await user.save();

  await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await Session.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}
