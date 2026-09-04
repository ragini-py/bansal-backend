import { env } from "../../config/env.js";
import { Settings, type SettingsDoc } from "./models/settings.model.js";
import type { UpdateSettingsInput } from "./settings.schemas.js";

export interface PublicSettings {
  brandName: string;
  tagline: string;
  supportEmail: string;
  supportPhone: string;
  codEnabled: boolean;
  razorpayEnabled: boolean;
  razorpayConnected: boolean;
  freeShippingThreshold: number;
  shippingFee: number;
  codFee: number;
  codMaxOrderValue: number;
  delhiveryConnected: boolean;
  emailProviderConnected: boolean;
  allowGuestBrowsing: boolean;
}

// There's exactly one settings document — find it, or create it with schema
// defaults the first time anything asks for it. Atomic upsert on the unique
// `singleton` field (not find-then-create) so two requests racing before the
// document exists can't each create their own copy.
async function getOrCreateSettings(): Promise<SettingsDoc> {
  return Settings.findOneAndUpdate(
    { singleton: true },
    { $setOnInsert: { singleton: true } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

function toPublicSettings(doc: SettingsDoc): PublicSettings {
  return {
    brandName: doc.brandName,
    tagline: doc.tagline,
    supportEmail: doc.supportEmail,
    supportPhone: doc.supportPhone,
    codEnabled: doc.codEnabled,
    razorpayEnabled: doc.razorpayEnabled,
    razorpayConnected: doc.razorpayConnected,
    freeShippingThreshold: doc.freeShippingThreshold,
    shippingFee: doc.shippingFee,
    codFee: doc.codFee,
    codMaxOrderValue: doc.codMaxOrderValue,
    delhiveryConnected: doc.delhiveryConnected,
    // Not stored — a live reflection of whether SMTP_* is actually
    // configured (see src/utils/email.ts), not an editable flag.
    emailProviderConnected: env.smtp !== null,
    allowGuestBrowsing: doc.allowGuestBrowsing,
  };
}

export async function getSettings(): Promise<PublicSettings> {
  return toPublicSettings(await getOrCreateSettings());
}

export async function updateSettings(input: UpdateSettingsInput): Promise<PublicSettings> {
  const doc = await getOrCreateSettings();
  doc.set(input);
  await doc.save();
  return toPublicSettings(doc);
}

// Used by orders.service.ts to price shipping/COD server-side — never the
// full PublicSettings shape, just the numbers that feed pricing.
export async function getPricingSettings(): Promise<SettingsDoc> {
  return getOrCreateSettings();
}
