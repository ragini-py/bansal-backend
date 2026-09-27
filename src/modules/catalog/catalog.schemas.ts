import { z } from "zod";

// Field-for-field match with the frontend's Product type
// (bansalnx-regal-suite/src/data/types.ts) minus `id`/`createdAt`, which the
// DB assigns. Used for the admin update endpoint — the frontend always sends
// a full product back (spread + patched fields), never a partial diff.
export const variantSchema = z.object({
  // Present when editing an existing variant (so the DB can keep its _id
  // stable across updates — see catalog.service.ts#updateProduct); absent
  // for a newly-added variant, which gets a fresh id on save.
  id: z.string().trim().min(1).optional(),
  size: z.string().trim().min(1),
  colour: z.string().trim().min(1),
  availability: z.enum(["available", "unavailable"]),
});

export const updateProductSchema = z.object({
  slug: z.string().trim().min(1),
  productCode: z.string().trim().min(1).optional(),
  styleNumber: z.string().trim().min(1).optional(),
  dressName: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  material: z.string().trim().min(1).optional(),
  clothMaterial: z.string().trim().min(1).optional(),
  price: z.number().min(0),
  mrp: z.number().min(0),
  discountedPrice: z.number().min(0).optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  quantity: z.number().int().min(0).optional(),
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
  availableSizes: z.array(z.string().trim()).optional(),
  colorOptions: z.array(z.string().trim()).optional(),
  additionalComment: z.string().trim().optional(),
  variants: z.array(variantSchema),
  featured: z.boolean(),
  bestseller: z.boolean(),
  newArrival: z.boolean(),
  published: z.boolean(),
  // Optimistic-concurrency guard — the version the client last read (see
  // catalog.service.ts's updateProduct). Optional so older/other callers
  // that never send it keep working exactly as before.
  version: z.number().int().min(0).optional(),
});
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// Same shape as an update — creating a new product from AdminPage's "Create
// Product" form sends the same full-object shape, just with no existing :id.
export const createProductSchema = updateProductSchema;
export type CreateProductInput = z.infer<typeof createProductSchema>;

// GET /products query params — all optional so an unparameterized request
// keeps returning the full catalog (see catalog.service.ts's listProducts).
export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  category: z.string().trim().min(1).optional(),
  collection: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  published: z.coerce.boolean().optional(),
  material: z.string().trim().min(1).optional(),
  clothMaterial: z.string().trim().min(1).optional(),
  color: z.string().trim().min(1).optional(),
  size: z.string().trim().min(1).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minDiscount: z.coerce.number().min(0).max(100).optional(),
  maxDiscount: z.coerce.number().min(0).max(100).optional(),
  badge: z.enum(["new", "bestseller", "exclusive"]).optional(),
  featured: z.coerce.boolean().optional(),
  bestseller: z.coerce.boolean().optional(),
  newArrival: z.coerce.boolean().optional(),
  tag: z.string().trim().min(1).optional(),
  sort: z
    .enum(["newest", "price_asc", "price_desc", "discount_desc", "name_asc", "name_desc", "featured_first", "bestseller_first"])
    .optional(),
});
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;

export const collectionSchema = z.object({
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().min(1),
  coverImage: z.string().trim().min(1),
  bannerImage: z.string().trim().min(1),
  productIds: z.array(z.string().trim().min(1)),
  featured: z.boolean(),
  published: z.boolean(),
  order: z.number(),
});
export type CollectionInput = z.infer<typeof collectionSchema>;
