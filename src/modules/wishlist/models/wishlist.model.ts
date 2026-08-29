import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const wishlistSchema = new Schema(
  {
    // One wishlist per user — upserted, never duplicated. Same pattern as
    // Cart (modules/cart/models/cart.model.ts).
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    productIds: { type: [String], default: [] },
  },
  { timestamps: false },
);

export type WishlistDoc = HydratedDocument<InferSchemaType<typeof wishlistSchema>>;

export const Wishlist = model("Wishlist", wishlistSchema);
