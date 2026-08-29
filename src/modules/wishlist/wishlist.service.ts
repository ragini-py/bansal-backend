import { Wishlist } from "./models/wishlist.model.js";
import type { ReplaceWishlistInput } from "./wishlist.schemas.js";

export async function getWishlist(userId: string): Promise<string[]> {
  const doc = await Wishlist.findOne({ userId });
  return doc?.productIds ?? [];
}

export async function replaceWishlist(userId: string, input: ReplaceWishlistInput): Promise<string[]> {
  const doc = await Wishlist.findOneAndUpdate(
    { userId },
    { $set: { productIds: input.productIds } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return doc.productIds;
}
