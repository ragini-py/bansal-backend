import { ConflictError, ForbiddenError, UnauthorizedError } from "../../common/app-error.js";
import { env } from "../../config/env.js";
import { sendEmail } from "../../utils/email.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { generateOpaqueToken, hashToken } from "../../utils/random-token.js";
import { signAccessToken, type AccessTokenPayload } from "../../utils/jwt.js";
import { PasswordResetToken, Session, User, type UserDoc } from "./models/index.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
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
  createdAt: string;
  addresses: PublicAddress[];
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
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

export async function registerUser(
  input: RegisterInput,
  meta: RequestMeta,
): Promise<{ user: PublicUser } & SessionTokens> {
  const existing = await User.findOne({ email: input.email });
  if (existing) throw new ConflictError("An account with this email already exists.");

  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
  });

  const tokens = await issueSession(user, meta);
  return { user: toPublicUser(user), ...tokens };
}

export async function loginUser(input: LoginInput, meta: RequestMeta): Promise<{ user: PublicUser } & SessionTokens> {
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  if (!user || !(await comparePassword(input.password, user.passwordHash))) {
    throw new UnauthorizedError("Invalid email or password.");
  }
  if (user.status === "blocked") {
    throw new ForbiddenError("This account has been suspended. Please contact us.");
  }

  const tokens = await issueSession(user, meta);
  return { user: toPublicUser(user), ...tokens };
}

export async function rotateSession(rawRefreshToken: string, meta: RequestMeta): Promise<SessionTokens> {
  const hash = hashToken(rawRefreshToken);
  const session = await Session.findOne({ refreshTokenHash: hash });
  if (!session || session.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid or expired refresh token.");
  }

  // Reuse detection: a session is only ever revoked by rotation, logout, or a
  // password reset. Seeing a *second* attempt to use one that's already
  // revoked means either the token was stolen and the thief raced the real
  // user, or the user's other tokens were compromised too — either way, the
  // safe response is to kill every live session for this account, not just
  // reject the one request.
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

  // Rotation: revoke the old session and issue a brand new one, rather than
  // reusing the same session document — limits how long a stolen (but not
  // yet used) refresh token stays valid.
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
  const user = await User.findById(id);
  return user ? toPublicUser(user) : null;
}

// Always succeeds from the caller's point of view, whether or not the email
// matches an account — ForgotPasswordPage's own copy already says "If an
// account exists for X, a link has been sent", so the controller must never
// let a caller distinguish the two cases (classic user-enumeration guard).
export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  const user = await User.findOne({ email: input.email });
  if (!user) return;

  const { token, hash } = generateOpaqueToken();
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + env.passwordResetTtlMs),
  });

  // sendEmail logs to the console instead of sending for real until SMTP_*
  // is configured (see .env.example) — same behavior as before, just moved
  // behind the shared email utility so it upgrades to real delivery for
  // free once that's filled in.
  const resetLink = `${env.corsOrigin}/reset-password?token=${token}`;
  // Best-effort, same as order confirmation email — a broken SMTP provider
  // must never surface a 500 here, or it becomes an enumeration oracle: a
  // non-existent email always returns instantly, so a send failure on a
  // *real* account throwing would let a caller tell the two cases apart by
  // response time/status alone.
  await sendEmail({
    to: user.email,
    subject: "Reset your Bansal-nx password",
    text: `Hi ${user.firstName},\n\nReset your password using the link below. It expires in ${Math.round(env.passwordResetTtlMs / 60000)} minutes.\n\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.`,
    html: `<p>Hi ${user.firstName},</p><p>Reset your password using the link below. It expires in ${Math.round(env.passwordResetTtlMs / 60000)} minutes.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
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

  // A password reset is a strong signal the old credential may have been
  // compromised — sign every other device out, same as a full logout.
  await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
}

// Self-service password change (caller already authenticated) — distinct
// from resetPassword above, which is for a caller who's locked out and using
// an emailed token instead of their current password.
export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw new UnauthorizedError("Account no longer exists.");
  if (!(await comparePassword(input.currentPassword, user.passwordHash))) {
    throw new UnauthorizedError("Current password is incorrect.");
  }

  user.passwordHash = await hashPassword(input.newPassword);
  await user.save();

  // Same reasoning as resetPassword: a password change is a strong signal
  // to invalidate every existing session, including the one that made this
  // request — the client re-authenticates with the new password afterward.
  await Session.updateMany({ userId: user._id, revokedAt: null }, { revokedAt: new Date() });
}

// Explicit "sign out everywhere" — revokes every live session for the
// caller without requiring a password change.
export async function revokeAllSessions(userId: string): Promise<void> {
  await Session.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}
