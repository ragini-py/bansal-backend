import { ConflictError } from "../../common/app-error.js";
import { env } from "../../config/env.js";
import { type AuditActor, recordAudit } from "../audit/audit.service.js";
import { Settings, type SettingsDoc } from "./models/settings.model.js";
import type { UpdateSettingsInput } from "./settings.schemas.js";

export interface PublicSettings {
  version: number;
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
    version: doc.__v,
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

export async function updateSettings(input: UpdateSettingsInput, actor: AuditActor): Promise<PublicSettings> {
  const doc = await getOrCreateSettings();
  if (input.version !== undefined && input.version !== doc.__v) {
    throw new ConflictError("Settings were changed by someone else. Please reload and try again.");
  }
  const before = toPublicSettings(doc);
  const { version: _expectedVersion, ...fields } = input;
  doc.set(fields);
  await doc.save();
  const after = toPublicSettings(doc);

  await recordAudit({
    actor,
    action: "settings.updated",
    entity: "settings",
    entityId: doc._id.toString(),
    before,
    after,
  });

  return after;
}

// Used by orders.service.ts to price shipping/COD server-side — never the
// full PublicSettings shape, just the numbers that feed pricing.
export async function getPricingSettings(): Promise<SettingsDoc> {
  return getOrCreateSettings();
}
