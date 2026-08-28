import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const AVAILABILITY = ["available", "unavailable"] as const;
const BADGES = ["new", "bestseller", "exclusive", null] as const;

const variantSchema = new Schema(
  {
    size: { type: String, required: true, trim: true },
    colour: { type: String, required: true, trim: true },
    availability: { type: String, enum: AVAILABILITY, default: "available" },
  },
  { _id: true },
);

const productSchema = new Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    images: { type: [String], default: [] },
    category: { type: String, required: true, trim: true },
    // Slugs of the collections this product belongs to (Collection.slug) —
    // matches the frontend's existing Product.collections shape exactly.
    collections: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    badge: { type: String, enum: BADGES, default: null },
    shortDescription: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    details: { type: [String], default: [] },
    care: { type: [String], default: [] },
    sizes: { type: [String], default: [] },
    colours: { type: [String], default: [] },
    variants: { type: [variantSchema], default: [] },
    featured: { type: Boolean, default: false },
    bestseller: { type: Boolean, default: false },
    newArrival: { type: Boolean, default: false },
    published: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type ProductDoc = HydratedDocument<InferSchemaType<typeof productSchema>>;

export const Product = model("Product", productSchema);
