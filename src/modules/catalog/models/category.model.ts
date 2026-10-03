import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedName: { type: String, required: true, unique: true, trim: true, lowercase: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  },
  { timestamps: true },
);

export type CategoryDoc = HydratedDocument<InferSchemaType<typeof categorySchema>>;

export const Category = model("Category", categorySchema);
