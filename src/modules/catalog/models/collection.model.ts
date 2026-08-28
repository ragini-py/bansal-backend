import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const collectionSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    coverImage: { type: String, required: true },
    bannerImage: { type: String, required: true },
    // Product _ids, as strings — matches the frontend's Collection.productIds
    // shape (an array of Product.id).
    productIds: { type: [String], default: [] },
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: false },
);

export type CollectionDoc = HydratedDocument<InferSchemaType<typeof collectionSchema>>;

export const Collection = model("Collection", collectionSchema);
