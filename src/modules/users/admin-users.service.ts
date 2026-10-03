import { ForbiddenError, NotFoundError } from "../../common/app-error.js";
import { type AuditActor, recordAudit } from "../audit/audit.service.js";
import { toPublicUser, type PublicUser } from "../auth/auth.service.js";
import { Session, User } from "../auth/models/index.js";
import type { UpdateUserInput } from "./admin-users.schemas.js";

export async function listUsers(): Promise<PublicUser[]> {
  const docs = await User.find().sort({ createdAt: -1 });
  return docs.map(toPublicUser);
}

export async function updateUser(
  id: string,
  callerId: string,
  patch: UpdateUserInput,
  actor: AuditActor,
): Promise<PublicUser> {
  // An admin changing their own role/status here is almost always a mistake
  // (self-demote or self-block), and could lock out the only admin account —
  // block it outright rather than trying to detect "the last admin" at the
  // DB level.
  if (id === callerId) {
    throw new ForbiddenError("You can't change your own role or status here.");
  }

  const user = await User.findById(id);
  if (!user) throw new NotFoundError("User not found.");

  const before = { role: user.role, status: user.status };
  if (patch.role !== undefined) user.role = patch.role;
  if (patch.status !== undefined) user.status = patch.status;
  await user.save();
  const after = { role: user.role, status: user.status };

  if (before.role !== after.role || before.status !== after.status) {
    if (after.status === "blocked" || before.role !== after.role) {
      await Session.updateMany({ userId: id, revokedAt: null }, { revokedAt: new Date() });
    }
    // Covers both "customer blocking" (status) and "admin permission
    // changes" (role) — the two are indistinguishable at the endpoint level
    // today (one generic PATCH), so both land under the same action, with
    // before/after making it clear which field actually moved.
    await recordAudit({
      actor,
      action: "user.updated",
      entity: "user",
      entityId: id,
      before,
      after,
    });
  }

  return toPublicUser(user);
}
