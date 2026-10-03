import { z } from "zod";

// Matches exactly what AdminPage's SettingsManagerTab actually edits today —
// the rest of StoreSettings (brandName, supportEmail, codEnabled, etc.) is
// read-only display/config for now, so there's no endpoint for it yet.
const catalogEnumArray = z.array(z.string().trim().min(1)).transform((items) =>
  Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => item.charAt(0).toUpperCase() + item.slice(1).toLowerCase()),
    ),
  ),
);

const catalogSizeArray = z.array(z.string().trim().min(1)).transform((items) =>
  Array.from(
    new Set(
      items
        .map((item) => item.trim())
        .filter(Boolean)
        .map((item) => /^(?:XXS|XS|S|M|L|XL|XXL|XXXL)$/i.test(item)
          ? item.toUpperCase()
          : item.charAt(0).toUpperCase() + item.slice(1).toLowerCase()),
    ),
  ),
);

export const updateSettingsSchema = z
  .object({
    tagline: z.string().trim(),
    supportEmail: z.string().trim().email(),
    supportPhone: z.string().trim(),
    codEnabled: z.boolean(),
    codFee: z.number().min(0),
    codMaxOrderValue: z.number().min(0),
    razorpayEnabled: z.boolean(),
    razorpayConnected: z.boolean(),
    delhiveryConnected: z.boolean(),
    allowGuestBrowsing: z.boolean(),
    freeShippingThreshold: z.number().min(0),
    shippingFee: z.number().min(0),
    catalogMaterials: catalogEnumArray,
    catalogColors: catalogEnumArray,
    catalogSizes: catalogSizeArray,
    catalogCategories: catalogEnumArray,
    // Optimistic-concurrency guard — the version the client last read (see
    // settings.service.ts's updateSettings). Optional so older/other
    // callers that never send it keep working exactly as before.
    version: z.number().int().min(0),
  })
  .partial();
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
