import { Content, type ContentDoc } from "./models/content.model.js";
import type { UpdateContentInput } from "./content.schemas.js";

// Seed copy for the very first document only (mirrors the frontend's
// previous mock — src/data/mock.ts's homepageContent — so the storefront
// isn't blank the first time this collection is created).
const DEFAULT_CONTENT = {
  announcement: {
    enabled: true,
    text: "Complimentary shipping on orders above ₹25,000 · Made to order in India",
  },
  hero: {
    eyebrow: "Autumn Ceremony 2026",
    heading: "An heirloom in the making",
    subheading:
      "Hand-embroidered silks and handloom weaves, made to order in our Jaipur studio for the women who wear them.",
    primaryCta: "SHOP NOW",
    secondaryCta: "EXPLORE COLLECTIONS",
  },
  editorial: {
    heading: "CRAFTED FOR THE EXTRAORDINARY YOU",
    caption: "Four hundred hours of hand work in a single ceremonial piece.",
    cta: "DISCOVER THE COLLECTION",
  },
  promo: {
    heading: "MAKE AN ENTRANCE",
    caption: "The Ceremony Edit — weighted silks, ceremonial colour, hand zardozi.",
    cta: "SHOP THE EDIT",
  },
  story: {
    heading: "Made by hand, for a lifetime",
    body: "Bansal-nx began in a single room in Jaipur with three karigars and one conviction: that a garment should outlive its occasion. Every piece is drawn by hand, embroidered by the same artisans who trained under our founder, and finished only when it is right. We make in small numbers, to order, and we sign nothing we would not keep.",
    cta: "OUR STORY",
  },
  sections: [
    { key: "collections", label: "Featured Collections", visible: true },
    { key: "new-arrivals", label: "New Arrivals", visible: true },
    { key: "editorial", label: "Editorial Image", visible: true },
    { key: "featured", label: "Featured Products", visible: true },
    { key: "story", label: "Brand Story", visible: true },
    { key: "promo", label: "Promotional Banner", visible: true },
    { key: "bestsellers", label: "Best Sellers", visible: true },
    { key: "newsletter", label: "Newsletter", visible: true },
  ],
  featuredCollectionIds: ["the-ceremony-edit", "quiet-hours", "heritage-classics"],
  featuredProductIds: ["emerald-zari-anarkali", "royal-velvet-lehenga"],
};

// There's exactly one content document — find it, or create it with the seed
// defaults above the first time anything asks for it. Atomic upsert on the
// unique `singleton` field (not find-then-create) so two requests racing
// before the document exists can't each create their own copy.
async function getOrCreateContent(): Promise<ContentDoc> {
  return Content.findOneAndUpdate(
    { singleton: true },
    { $setOnInsert: { singleton: true, ...DEFAULT_CONTENT } },
    { upsert: true, new: true },
  );
}

export interface PublicContent {
  announcement: { enabled: boolean; text: string };
  hero: {
    eyebrow: string;
    heading: string;
    subheading: string;
    primaryCta: string;
    secondaryCta: string;
  };
  editorial: { heading: string; caption: string; cta: string };
  promo: { heading: string; caption: string; cta: string };
  story: { heading: string; body: string; cta: string };
  sections: { key: string; label: string; visible: boolean }[];
  featuredCollectionIds: string[];
  featuredProductIds: string[];
}

function toPublicContent(doc: ContentDoc): PublicContent {
  return {
    // Nested subdocuments are typed optional by InferSchemaType even though
    // the schema always populates them with defaults — never actually
    // undefined on a real document.
    announcement: doc.announcement!,
    hero: doc.hero!,
    editorial: doc.editorial!,
    promo: doc.promo!,
    story: doc.story!,
    sections: doc.sections,
    featuredCollectionIds: doc.featuredCollectionIds,
    featuredProductIds: doc.featuredProductIds,
  };
}

export async function getContent(): Promise<PublicContent> {
  return toPublicContent(await getOrCreateContent());
}

export async function updateContent(input: UpdateContentInput): Promise<PublicContent> {
  const doc = await getOrCreateContent();
  doc.set(input);
  await doc.save();
  return toPublicContent(doc);
}
