import { isValidObjectId, Types, type FilterQuery } from "mongoose";
import { BadRequestError, ConflictError, NotFoundError } from "../../common/app-error.js";
import { type AuditActor, recordAudit } from "../audit/audit.service.js";
import {
  Category,
  Collection,
  Product,
  type CategoryDoc,
  type CollectionDoc,
  type ProductDoc,
} from "./models/index.js";
import type {
  CollectionInput,
  CreateCategoryInput,
  CreateProductInput,
  ListProductsQuery,
  UpdateCategoryInput,
  UpdateProductInput,
} from "./catalog.schemas.js";

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export function toPublicCategory(doc: CategoryDoc): PublicCategory {
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

export function normalizeCategoryName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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
  categoryIds: string[];
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
    category: doc.category || "",
    categoryIds: (doc.categoryIds ?? []).map((id) => id.toString()),
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
    const trimmed = query.category.trim();
    const escaped = escapeRegex(trimmed);
    const matchedCategory = await Category.findOne({
      $or: [
        { slug: slugify(trimmed) },
        { normalizedName: normalizeCategoryName(trimmed) },
      ],
    });
    if (matchedCategory) {
      filter.$or = [
        { categoryIds: matchedCategory._id },
        { category: new RegExp(`^${escaped}$`, "i") },
      ];
    } else {
      filter.category = new RegExp(`^${escaped}$`, "i");
    }
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

async function validateAndResolveCategories(
  categoryIds?: string[],
  categoryName?: string,
): Promise<{ categoryIds: Types.ObjectId[]; category: string }> {
  let resolvedIds: Types.ObjectId[] = [];
  let resolvedCategory = categoryName?.trim() || "";

  if (categoryIds && categoryIds.length > 0) {
    const uniqueIds = Array.from(new Set(categoryIds.map((id) => id.trim())));
    for (const cid of uniqueIds) {
      if (!isValidObjectId(cid)) {
        throw new BadRequestError(`Invalid category ID: "${cid}".`);
      }
    }

    const found = await Category.find({ _id: { $in: uniqueIds } });
    if (found.length !== uniqueIds.length) {
      throw new BadRequestError("One or more referenced categories do not exist.");
    }

    resolvedIds = found.map((c) => c._id as Types.ObjectId);
    if (!resolvedCategory && found.length > 0) {
      resolvedCategory = found[0].name;
    }
  } else if (resolvedCategory) {
    const found = await Category.findOne({
      normalizedName: normalizeCategoryName(resolvedCategory),
    });
    if (found) {
      resolvedIds = [found._id as Types.ObjectId];
    }
  }

  return { categoryIds: resolvedIds, category: resolvedCategory };
}

export async function createProduct(input: CreateProductInput): Promise<PublicProduct> {
  const existing = await Product.findOne({ slug: input.slug });
  if (existing) throw new ConflictError("A product with this slug already exists.");

  const { categoryIds, category } = await validateAndResolveCategories(
    input.categoryIds,
    input.category,
  );

  const doc = await Product.create({
    ...input,
    category,
    categoryIds,
  });
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

  const { categoryIds, category } = await validateAndResolveCategories(
    input.categoryIds,
    input.category ?? doc.category,
  );

  const { variants, version: _expectedVersion, ...rest } = input;
  doc.set({
    ...rest,
    category,
    categoryIds,
  });
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

export async function listCategories(): Promise<PublicCategory[]> {
  const docs = await Category.find().sort({ name: 1 });
  return docs.map(toPublicCategory);
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<{ category: PublicCategory; created: boolean }> {
  const trimmed = input.name.trim();
  if (!trimmed) throw new BadRequestError("Category name cannot be empty.");
  const normalizedName = normalizeCategoryName(trimmed);
  const slug = slugify(trimmed);
  if (!slug) throw new BadRequestError("Invalid category name.");

  const existing = await Category.findOne({
    $or: [{ normalizedName }, { slug }],
  });
  if (existing) {
    return { category: toPublicCategory(existing), created: false };
  }

  try {
    const doc = await Category.create({ name: trimmed, normalizedName, slug });
    return { category: toPublicCategory(doc), created: true };
  } catch (err: any) {
    if (err?.code === 11000) {
      const found = await Category.findOne({
        $or: [{ normalizedName }, { slug }],
      });
      if (found) {
        return { category: toPublicCategory(found), created: false };
      }
    }
    throw err;
  }
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<PublicCategory> {
  if (!isValidObjectId(id)) throw new BadRequestError("Invalid category ID.");
  const doc = await Category.findById(id);
  if (!doc) throw new NotFoundError("Category not found.");

  const trimmed = input.name.trim();
  if (!trimmed) throw new BadRequestError("Category name cannot be empty.");
  const normalizedName = normalizeCategoryName(trimmed);
  const slug = slugify(trimmed);
  if (!slug) throw new BadRequestError("Invalid category name.");

  const existing = await Category.findOne({
    _id: { $ne: id },
    $or: [{ normalizedName }, { slug }],
  });
  if (existing) {
    throw new ConflictError("A category with this name or slug already exists.");
  }

  doc.set({ name: trimmed, normalizedName, slug });
  await doc.save();
  return toPublicCategory(doc);
}

export async function deleteCategory(id: string): Promise<void> {
  if (!isValidObjectId(id)) throw new BadRequestError("Invalid category ID.");
  const doc = await Category.findById(id);
  if (!doc) throw new NotFoundError("Category not found.");

  await Product.updateMany(
    { categoryIds: doc._id },
    { $pull: { categoryIds: doc._id } },
  );

  await Category.findByIdAndDelete(id);
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
