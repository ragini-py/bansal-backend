import { z } from "zod";

// Field-for-field match with the frontend's Product type
// (bansalnx-regal-suite/src/data/types.ts) minus `id`/`createdAt`, which the
// DB assigns. Used for the admin update endpoint — the frontend always sends
// a full product back (spread + patched fields), never a partial diff.
export const variantSchema = z.object({
  size: z.string().trim().min(1),
  colour: z.string().trim().min(1),
  availability: z.enum(["available", "unavailable"]),
});

export const updateProductSchema = z.object({
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  price: z.number().min(0),
  mrp: z.number().min(0),
  currency: z.literal("INR"),
  images: z.array(z.string().trim().min(1)),
  category: z.string().trim().min(1),
  collections: z.array(z.string().trim().min(1)),
  tags: z.array(z.string().trim()),
  badge: z.enum(["new", "bestseller", "exclusive"]).nullable(),
  shortDescription: z.string().trim().min(1),
  description: z.string().trim().min(1),
  details: z.array(z.string().trim()),
  care: z.array(z.string().trim()),
  sizes: z.array(z.string().trim()),
  colours: z.array(z.string().trim()),
  variants: z.array(variantSchema),
  featured: z.boolean(),
  bestseller: z.boolean(),
  newArrival: z.boolean(),
  published: z.boolean(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
