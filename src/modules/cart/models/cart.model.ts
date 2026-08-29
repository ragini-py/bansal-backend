import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const cartLineSchema = new Schema(
  {
    productId: { type: String, required: true },
    variantId: { type: String, required: true },
    size: { type: String, required: true },
    colour: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const cartSchema = new Schema(
  {
    // One cart per user — upserted, never duplicated.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    lines: { type: [cartLineSchema], default: [] },
  },
  { timestamps: false },
);

export type CartDoc = HydratedDocument<InferSchemaType<typeof cartSchema>>;

export const Cart = model("Cart", cartSchema);
