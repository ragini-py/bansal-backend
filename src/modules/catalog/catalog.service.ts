import type { FilterQuery } from "mongoose";
import { ConflictError, NotFoundError } from "../../common/app-error.js";
import { type AuditActor, recordAudit } from "../audit/audit.service.js";
import { Collection, Product, type CollectionDoc, type ProductDoc } from "./models/index.js";
import type {
  CollectionInput,
  CreateProductInput,
  ListProductsQuery,
  UpdateProductInput,
} from "./catalog.schemas.js";

export interface PublicVariant {
  id: string;
  size: string;
  colour: string;
  availability: "available" | "unavailable";
}

export interface PublicProduct {
  id: string;
  version: number;
  slug: string;
  productCode?: string;
  styleNumber?: string;
  dressName?: string;
  name: string;
  material?: string;
  clothMaterial?: string;
  price: number;
  mrp: number;
  discountedPrice?: number | null;
  discountPercentage?: number;
  quantity?: number;
  currency: "INR";
  images: string[];
  category: string;
  collections: string[];
  tags: string[];
  badge: "new" | "bestseller" | "exclusive" | null;
  shortDescription: string;
  description: string;
  details: string[];
  care: string[];
  sizes: string[];
  colours: string[];
  availableSizes?: string[];
  colorOptions?: string[];
  additionalComment?: string;
  variants: PublicVariant[];
  featured: boolean;
  bestseller: boolean;
  newArrival: boolean;
  published: boolean;
  createdAt: string;
}

export interface PublicCollection {
  id: string;
  slug: string;
  name: string;
  description: string;
  coverImage: string;
  bannerImage: string;
  productIds: string[];
  featured: boolean;
  published: boolean;
  order: number;
}

// Matches frontend/src/data/types.ts's Product/Collection exactly — that
// file's own comment states the intent: "every shape here is designed to
// map 1:1 onto a future REST/DB layer so components never change."
export function toPublicProduct(doc: ProductDoc): PublicProduct {
  return {
    id: doc._id.toString(),
    version: doc.__v,
    slug: doc.slug,
    productCode: doc.productCode ?? undefined,
    styleNumber: doc.styleNumber ?? undefined,
    dressName: doc.dressName ?? doc.name,
    name: doc.name,
    material: doc.material ?? undefined,
    clothMaterial: doc.clothMaterial ?? undefined,
    price: doc.price,
    mrp: doc.mrp,
    discountedPrice: doc.discountedPrice ?? null,
    discountPercentage: doc.discountPercentage ?? 0,
    quantity: doc.quantity ?? 0,
    currency: doc.currency,
    images: doc.images,
    category: doc.category,
    collections: doc.collections,
    tags: doc.tags,
    badge: doc.badge as PublicProduct["badge"],
    shortDescription: doc.shortDescription,
    description: doc.description,
    details: doc.details,
    care: doc.care,
    sizes: doc.sizes,
    colours: doc.colours,
    availableSizes: doc.availableSizes ?? doc.sizes,
    colorOptions: doc.colorOptions ?? doc.colours,
    additionalComment: doc.additionalComment,
    variants: doc.variants.map((v) => ({
      id: v._id.toString(),
      size: v.size,
      colour: v.colour,
      availability: v.availability,
    })),
    featured: doc.featured,
    bestseller: doc.bestseller,
    newArrival: doc.newArrival,
    published: doc.published,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function toPublicCollection(doc: CollectionDoc): PublicCollection {
  return {
    id: doc._id.toString(),
    slug: doc.slug,
    name: doc.name,
    description: doc.description,
    coverImage: doc.coverImage,
    bannerImage: doc.bannerImage,
    productIds: doc.productIds,
    featured: doc.featured,
    published: doc.published,
    order: doc.order,
  };
}

export interface ProductPage {
  products: PublicProduct[];
  total: number;
  page: number;
  limit: number;
}

// Escape regex metacharacters in free-text search input — this string goes
// straight into a Mongo $regex, and an unescaped ".*" or similarly crafted
// input could either match everything or (worst case) craft a pathological
// backtracking pattern.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Backward compatible by construction: with no page/limit in the query, this
// returns the full (optionally filtered) result set exactly as before, so
// every existing caller (the frontend's boot-time full-catalog fetch) keeps
// working unchanged. page/limit are opt-in for a caller that wants real
// pagination (e.g. an admin product table, or a future storefront rewrite)
// instead of "fetch everything, filter client-side".
export async function listProducts(query: ListProductsQuery = {}): Promise<ProductPage> {
  const filter: FilterQuery<Record<string, unknown>> = {};

  if (query.category) {
    filter.category = new RegExp(`^${escapeRegex(query.category.trim())}$`, "i");
  }
  if (query.collection) {
    filter.collections = new RegExp(`^${escapeRegex(query.collection.trim())}$`, "i");
  }
  if (query.published !== undefined) filter.published = query.published;
  if (query.material) filter.material = new RegExp(`^${escapeRegex(query.material.trim())}$`, "i");
  if (query.clothMaterial)
    filter.clothMaterial = new RegExp(`^${escapeRegex(query.clothMaterial.trim())}$`, "i");
  if (query.badge) filter.badge = query.badge;
  if (query.featured !== undefined) filter.featured = query.featured;
  if (query.bestseller !== undefined) filter.bestseller = query.bestseller;
  if (query.newArrival !== undefined) filter.newArrival = query.newArrival;
  if (query.tag) filter.tags = new RegExp(`^${escapeRegex(query.tag.trim())}$`, "i");

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {} as Record<string, number>;
    if (query.minPrice !== undefined) (filter.price as Record<string, number>).$gte = query.minPrice;
    if (query.maxPrice !== undefined) (filter.price as Record<string, number>).$lte = query.maxPrice;
  }

  if (query.minDiscount !== undefined || query.maxDiscount !== undefined) {
    filter.discountPercentage = {} as Record<string, number>;
    if (query.minDiscount !== undefined) (filter.discountPercentage as Record<string, number>).$gte = query.minDiscount;
    if (query.maxDiscount !== undefined) (filter.discountPercentage as Record<string, number>).$lte = query.maxDiscount;
  }

  if (query.size) {
    filter.$or = [
      { sizes: new RegExp(`^${escapeRegex(query.size.trim())}$`, "i") },
      { availableSizes: new RegExp(`^${escapeRegex(query.size.trim())}$`, "i") },
    ];
  }

  if (query.color) {
    const colorRegex = new RegExp(`^${escapeRegex(query.color.trim())}$`, "i");
    filter.$or = [
      ...(Array.isArray(filter.$or) ? filter.$or : []),
      { colours: colorRegex },
      { colorOptions: colorRegex },
    ];
  }

  if (query.search?.trim()) {
    const searchRegex = new RegExp(escapeRegex(query.search.trim()), "i");
    const searchFields = [
      { name: searchRegex },
      { dressName: searchRegex },
      { slug: searchRegex },
      { productCode: searchRegex },
      { styleNumber: searchRegex },
      { shortDescription: searchRegex },
      { description: searchRegex },
      { material: searchRegex },
      { clothMaterial: searchRegex },
      { category: searchRegex },
      { tags: searchRegex },
      { collections: searchRegex },
      { colours: searchRegex },
      { sizes: searchRegex },
      { availableSizes: searchRegex },
      { colorOptions: searchRegex },
      { additionalComment: searchRegex },
    ];
    filter.$or = [...(Array.isArray(filter.$or) ? filter.$or : []), ...searchFields];
  }

  const total = await Product.countDocuments(filter);
  let cursor = Product.find(filter);

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    price_asc: { price: 1, createdAt: -1 },
    price_desc: { price: -1, createdAt: -1 },
    discount_desc: { discountPercentage: -1, createdAt: -1 },
    name_asc: { name: 1 },
    name_desc: { name: -1 },
    featured_first: { featured: -1, createdAt: -1 },
    bestseller_first: { bestseller: -1, createdAt: -1 },
  };

  cursor = cursor.sort(sortMap[query.sort ?? "newest"] ?? sortMap.newest);

  let page = 1;
  let limit = total;
  if (query.page !== undefined || query.limit !== undefined) {
    limit = query.limit ?? 24;
    page = query.page ?? 1;
    cursor = cursor.skip((page - 1) * limit).limit(limit);
  }

  const docs = await cursor;
  return { products: docs.map(toPublicProduct), total, page, limit };
}

export async function getProductBySlug(slug: string): Promise<PublicProduct> {
  const doc = await Product.findOne({ slug, published: true });
  if (!doc) throw new NotFoundError("Product not found.");
  return toPublicProduct(doc);
}

export async function createProduct(input: CreateProductInput): Promise<PublicProduct> {
  const existing = await Product.findOne({ slug: input.slug });
  if (existing) throw new ConflictError("A product with this slug already exists.");
  const doc = await Product.create(input);
  return toPublicProduct(doc);
}

export async function updateProduct(id: string, input: UpdateProductInput): Promise<PublicProduct> {
  const doc = await Product.findById(id);
  if (!doc) throw new NotFoundError("Product not found.");
  // Optimistic concurrency — only enforced when the caller sends the version
  // it last read. Catches "admin A edits a product, admin B edits the same
  // product from a stale copy, B's save silently overwrites A's change".
  if (input.version !== undefined && input.version !== doc.__v) {
    throw new ConflictError("This product was changed by someone else. Please reload and try again.");
  }
  if (input.slug !== doc.slug) {
    const existing = await Product.findOne({ slug: input.slug });
    if (existing) throw new ConflictError("A product with this slug already exists.");
  }
  const { variants, version: _expectedVersion, ...rest } = input;
  doc.set(rest);
  // Keep each existing variant's _id stable (it's referenced by carts,
  // wishlists, and past orders as variantId) — only variants with no `id`
  // (newly added in the admin form) get a fresh one from Mongoose.
  doc.set(
    "variants",
    variants.map((v) => (v.id ? { _id: v.id, size: v.size, colour: v.colour, availability: v.availability } : v)),
  );
  await doc.save();
  return toPublicProduct(doc);
}

export async function deleteProduct(id: string, actor: AuditActor): Promise<void> {
  const doc = await Product.findByIdAndDelete(id);
  if (!doc) throw new NotFoundError("Product not found.");
  await recordAudit({
    actor,
    action: "product.deleted",
    entity: "product",
    entityId: id,
    before: toPublicProduct(doc),
  });
}

export async function listCollections(): Promise<PublicCollection[]> {
  const docs = await Collection.find().sort({ order: 1 });
  return docs.map(toPublicCollection);
}

export async function getCollectionBySlug(slug: string): Promise<PublicCollection> {
  const doc = await Collection.findOne({ slug });
  if (!doc) throw new NotFoundError("Collection not found.");
  return toPublicCollection(doc);
}

export async function createCollection(input: CollectionInput): Promise<PublicCollection> {
  const existing = await Collection.findOne({ slug: input.slug });
  if (existing) throw new ConflictError("A collection with this slug already exists.");
  const doc = await Collection.create(input);
  return toPublicCollection(doc);
}

export async function updateCollection(id: string, input: CollectionInput): Promise<PublicCollection> {
  const doc = await Collection.findById(id);
  if (!doc) throw new NotFoundError("Collection not found.");
  if (input.slug !== doc.slug) {
    const existing = await Collection.findOne({ slug: input.slug });
    if (existing) throw new ConflictError("A collection with this slug already exists.");
  }
  doc.set(input);
  await doc.save();
  return toPublicCollection(doc);
}

export async function deleteCollection(id: string): Promise<void> {
  const doc = await Collection.findByIdAndDelete(id);
  if (!doc) throw new NotFoundError("Collection not found.");
}
