import { ConflictError } from "../../common/app-error.js";
import { env } from "../../config/env.js";
import { type AuditActor, recordAudit } from "../audit/audit.service.js";
import { Settings, type SettingsDoc } from "./models/settings.model.js";
import type { UpdateSettingsInput } from "./settings.schemas.js";

export interface PincodeCheckResult {
  provider: "shiprocket";
  mode: "demo" | "live";
  available: boolean;
  pincode: string;
  pickupPincode: string;
  message: string;
}

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
  catalogMaterials: string[];
  catalogColors: string[];
  catalogSizes: string[];
  catalogCategories: string[];
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

function normalizeCatalogEnumValues(values: string[] = []): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()),
    ),
  );
}

function normalizeCatalogSizeValues(values: string[] = []): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => /^(?:XXS|XS|S|M|L|XL|XXL|XXXL)$/i.test(value)
          ? value.toUpperCase()
          : value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()),
    ),
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
    catalogMaterials: normalizeCatalogEnumValues(doc.catalogMaterials),
    catalogColors: normalizeCatalogEnumValues(doc.catalogColors),
    catalogSizes: normalizeCatalogSizeValues(doc.catalogSizes),
    catalogCategories: normalizeCatalogEnumValues(doc.catalogCategories),
  };
}

export async function getSettings(): Promise<PublicSettings> {
  return toPublicSettings(await getOrCreateSettings());
}

export async function checkPincodeAvailability(pincode: string): Promise<PincodeCheckResult> {
  const normalized = pincode.replace(/\D/g, "").trim();
  if (!normalized || normalized.length < 4) {
    return {
      provider: "shiprocket",
      mode: "demo",
      available: false,
      pincode: normalized,
      pickupPincode: env.shiprocket.pickupPincode,
      message: "Please enter a valid Indian pincode to check shipping availability.",
    };
  }

  const isDemo =
    !env.shiprocket.email ||
    /demo|example|replace/i.test(env.shiprocket.email) ||
    !env.shiprocket.password ||
    /demo|example|replace/i.test(env.shiprocket.password);

  if (isDemo) {
    const demoAvailable = ["700019", "700001", "700016", "700020", "110001", "560001"].includes(normalized);
    return {
      provider: "shiprocket",
      mode: "demo",
      available: demoAvailable,
      pincode: normalized,
      pickupPincode: env.shiprocket.pickupPincode,
      message: demoAvailable
        ? "Shipping is available to this pincode in demo mode. Replace Shiprocket credentials in env to go live."
        : "This pincode is not serviceable in demo mode. Replace Shiprocket credentials in env to go live.",
    };
  }

  try {
    const loginRes = await fetch(`${env.shiprocket.baseUrl.replace(/\/$/, "")}/v1/external/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: env.shiprocket.email, password: env.shiprocket.password }),
    });

    if (!loginRes.ok) {
      throw new Error(`Shiprocket login failed with ${loginRes.status}`);
    }

    const loginBody = (await loginRes.json()) as { token?: string; data?: { token?: string } };
    const token = loginBody.token ?? loginBody.data?.token;
    if (!token) {
      throw new Error("Shiprocket login response did not include a token.");
    }

    const serviceRes = await fetch(`${env.shiprocket.baseUrl.replace(/\/$/, "")}/v1/external/courier/serviceability`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        pickup_postcode: env.shiprocket.pickupPincode,
        delivery_postcode: normalized,
        cod: 0,
        weight: 0.5,
      }),
    });

    const serviceBody = (await serviceRes.json()) as {
      status?: string;
      data?: { available?: boolean; courier_company?: string[]; response?: string[] };
    };

    const available = serviceRes.ok && (serviceBody.data?.available ?? true);
    return {
      provider: "shiprocket",
      mode: "live",
      available,
      pincode: normalized,
      pickupPincode: env.shiprocket.pickupPincode,
      message: available
        ? "This pincode is serviceable by Shiprocket."
        : "This pincode is not currently serviceable by Shiprocket.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      provider: "shiprocket",
      mode: "demo",
      available: false,
      pincode: normalized,
      pickupPincode: env.shiprocket.pickupPincode,
      message: `Shiprocket check failed. Falling back to demo mode (${message}).`,
    };
  }
}

export async function updateSettings(input: UpdateSettingsInput, actor: AuditActor): Promise<PublicSettings> {
  const doc = await getOrCreateSettings();
  if (input.version !== undefined && input.version !== doc.__v) {
    throw new ConflictError("Settings were changed by someone else. Please reload and try again.");
  }
  const before = toPublicSettings(doc);
  const { version: _expectedVersion, ...fields } = input;
  void _expectedVersion;

  if (fields.catalogMaterials) doc.set("catalogMaterials", normalizeCatalogEnumValues(fields.catalogMaterials));
  if (fields.catalogColors) doc.set("catalogColors", normalizeCatalogEnumValues(fields.catalogColors));
  if (fields.catalogSizes) doc.set("catalogSizes", normalizeCatalogSizeValues(fields.catalogSizes));
  if (fields.catalogCategories) doc.set("catalogCategories", normalizeCatalogEnumValues(fields.catalogCategories));

  const remainingFields = Object.fromEntries(
    Object.entries(fields).filter(
      ([key]) => !["catalogMaterials", "catalogColors", "catalogSizes", "catalogCategories"].includes(key),
    ),
  );
  doc.set(remainingFields);
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
