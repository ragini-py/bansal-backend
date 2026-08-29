import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Singleton — exactly one document ever exists (see settings.service.ts's
// findOneAndUpdate upsert). There's no per-user or per-tenant concept in
// this app, so a single global config row is simpler than a key registry.
const settingsSchema = new Schema(
  {
    brandName: { type: String, default: "Bansal-nx" },
    tagline: { type: String, default: "CRAFTED FOR THE EXTRAORDINARY YOU" },
    supportEmail: { type: String, default: "support@bansal-nx.com" },
    supportPhone: { type: String, default: "+91 98110 45500" },
    codEnabled: { type: Boolean, default: true },
    razorpayEnabled: { type: Boolean, default: true },
    razorpayConnected: { type: Boolean, default: false },
    freeShippingThreshold: { type: Number, default: 25000 },
    shippingFee: { type: Number, default: 350 },
    codFee: { type: Number, default: 99 },
    codMaxOrderValue: { type: Number, default: 50000 },
    delhiveryConnected: { type: Boolean, default: false },
    allowGuestBrowsing: { type: Boolean, default: true },
  },
  { timestamps: false },
);

export type SettingsDoc = HydratedDocument<InferSchemaType<typeof settingsSchema>>;

export const Settings = model("Settings", settingsSchema);
