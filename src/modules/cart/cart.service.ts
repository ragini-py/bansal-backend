import { Cart } from "./models/cart.model.js";
import type { ReplaceCartInput } from "./cart.schemas.js";

export interface PublicCartLine {
  productId: string;
  variantId: string;
  size: string;
  colour: string;
  quantity: number;
}

export async function getCart(userId: string): Promise<PublicCartLine[]> {
  const cart = await Cart.findOne({ userId });
  return cart?.lines ?? [];
}

export async function replaceCart(userId: string, input: ReplaceCartInput): Promise<PublicCartLine[]> {
  const cart = await Cart.findOneAndUpdate(
    { userId },
    { $set: { lines: input.lines } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return cart.lines;
}
