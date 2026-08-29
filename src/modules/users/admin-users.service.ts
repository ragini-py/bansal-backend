import { ForbiddenError, NotFoundError } from "../../common/app-error.js";
import { toPublicUser, type PublicUser } from "../auth/auth.service.js";
import { User } from "../auth/models/index.js";
import type { UpdateUserInput } from "./admin-users.schemas.js";

export async function listUsers(): Promise<PublicUser[]> {
  const docs = await User.find().sort({ createdAt: -1 });
  return docs.map(toPublicUser);
}

export async function updateUser(
  id: string,
  callerId: string,
  patch: UpdateUserInput,
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

  if (patch.role !== undefined) user.role = patch.role;
  if (patch.status !== undefined) user.status = patch.status;
  await user.save();

  return toPublicUser(user);
}
