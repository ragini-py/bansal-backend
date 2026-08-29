import { ConflictError, NotFoundError } from "../../common/app-error.js";
import { Collection, Product, type CollectionDoc, type ProductDoc } from "./models/index.js";
import type { CollectionInput, CreateProductInput, UpdateProductInput } from "./catalog.schemas.js";

export interface PublicVariant {
  id: string;
  size: string;
  colour: string;
  availability: "available" | "unavailable";
}

export interface PublicProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  mrp: number;
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
    slug: doc.slug,
    name: doc.name,
    price: doc.price,
    mrp: doc.mrp,
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

export async function listProducts(): Promise<PublicProduct[]> {
  const docs = await Product.find().sort({ createdAt: -1 });
  return docs.map(toPublicProduct);
}

export async function getProductBySlug(slug: string): Promise<PublicProduct> {
  const doc = await Product.findOne({ slug });
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
  doc.set(input);
  await doc.save();
  return toPublicProduct(doc);
}

export async function deleteProduct(id: string): Promise<void> {
  const doc = await Product.findByIdAndDelete(id);
  if (!doc) throw new NotFoundError("Product not found.");
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
  doc.set(input);
  await doc.save();
  return toPublicCollection(doc);
}

export async function deleteCollection(id: string): Promise<void> {
  const doc = await Collection.findByIdAndDelete(id);
  if (!doc) throw new NotFoundError("Collection not found.");
}
