import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Singleton — exactly one document ever exists (see content.service.ts's
// findOneAndUpdate upsert), same convention as Settings. Backs the homepage
// hero/editorial/promo/story copy, the announcement bar, section visibility,
// and the featured product/collection picks.
const sectionSchema = new Schema(
  {
    key: { type: String, required: true },
    label: { type: String, required: true },
    visible: { type: Boolean, default: true },
  },
  { _id: false },
);

const contentSchema = new Schema(
  {
    // Unique + always `true` so the upsert in content.service.ts can never
    // create a second document even if two "create if missing" requests race.
    singleton: { type: Boolean, default: true, unique: true },
    announcement: {
      enabled: { type: Boolean, default: true },
      text: { type: String, default: "" },
    },
    hero: {
      image: { type: String, default: "" },
      eyebrow: { type: String, default: "" },
      heading: { type: String, default: "" },
      subheading: { type: String, default: "" },
      primaryCta: { type: String, default: "" },
      secondaryCta: { type: String, default: "" },
    },
    editorial: {
      image: { type: String, default: "" },
      heading: { type: String, default: "" },
      caption: { type: String, default: "" },
      cta: { type: String, default: "" },
    },
    promo: {
      image: { type: String, default: "" },
      heading: { type: String, default: "" },
      caption: { type: String, default: "" },
      cta: { type: String, default: "" },
    },
    story: {
      heading: { type: String, default: "" },
      body: { type: String, default: "" },
      cta: { type: String, default: "" },
    },
    sections: { type: [sectionSchema], default: [] },
    featuredCollectionIds: { type: [String], default: [] },
    featuredProductIds: { type: [String], default: [] },
  },
  { timestamps: false },
);

export type ContentDoc = HydratedDocument<InferSchemaType<typeof contentSchema>>;

export const Content = model("Content", contentSchema);
