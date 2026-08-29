import { z } from "zod";

// Matches exactly what AdminPage's SettingsManagerTab actually edits today —
// the rest of StoreSettings (brandName, supportEmail, codEnabled, etc.) is
// read-only display/config for now, so there's no endpoint for it yet.
export const updateSettingsSchema = z
  .object({
    freeShippingThreshold: z.number().min(0),
    shippingFee: z.number().min(0),
    codMaxOrderValue: z.number().min(0),
  })
  .partial();
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
