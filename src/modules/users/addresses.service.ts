import { NotFoundError } from "../../common/app-error.js";
import { toPublicUser, type PublicUser } from "../auth/auth.service.js";
import { User } from "../auth/models/index.js";
import type { CreateAddressInput } from "./addresses.schemas.js";

export async function addAddress(userId: string, input: CreateAddressInput): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("Account no longer exists.");

  // The very first address is always the default; otherwise honor the
  // caller's choice and demote any previously-default address.
  const makeDefault = user.addresses.length === 0 || input.isDefault;
  if (makeDefault) {
    for (const a of user.addresses) a.isDefault = false;
  }

  user.addresses.push({ ...input, isDefault: makeDefault });
  await user.save();
  return toPublicUser(user);
}

export async function removeAddress(userId: string, addressId: string): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("Account no longer exists.");

  const address = user.addresses.id(addressId);
  if (!address) throw new NotFoundError("Address not found.");

  const wasDefault = address.isDefault;
  address.deleteOne();
  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0].isDefault = true;
  }

  await user.save();
  return toPublicUser(user);
}
