import { z } from "zod";

// Matches the frontend's CartLine type (bansalnx-regal-suite/src/data/types.ts) exactly.
export const cartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().min(1),
  size: z.string().min(1),
  colour: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
});

export const replaceCartSchema = z.object({
  lines: z.array(cartLineSchema),
});
export type ReplaceCartInput = z.infer<typeof replaceCartSchema>;
