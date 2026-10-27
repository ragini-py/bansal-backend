import { Content, type ContentDoc } from "./models/content.model.js";
import type { UpdateContentInput } from "./content.schemas.js";

// Seed copy for the very first document only (mirrors the frontend's
// previous mock — src/data/mock.ts's homepageContent — so the storefront
// isn't blank the first time this collection is created).
const DEFAULT_CONTENT = {
  announcement: {
    enabled: true,
    text: "Bansal NX · 15+ Years of Manufacturing Excellence · Serving 1,000+ Retailers Across India & Overseas",
  },
  hero: {
    eyebrow: "15+ Years of Experience",
    heading: "Redefining Women's Fashion",
    subheading:
      "Manufacturer of premium ethnic & contemporary wear in Kolkata. Combining elegance, comfort, and evolving fashion trends.",
    primaryCta: "SHOP NOW",
    secondaryCta: "ABOUT US",
  },
  editorial: {
    heading: "CRAFTED FOR THE EXTRAORDINARY YOU",
    caption:
      "Every collection reflects confidence, individuality, and refined style — from design and manufacturing to the finished garment.",
    cta: "DISCOVER THE COLLECTION",
  },
  promo: {
    heading: "INTRODUCING CHAMAK — BY BANSAL NX",
    caption:
      "A premium women's fashion brand celebrating Indian craftsmanship with a contemporary design approach for today's modern woman.",
    cta: "EXPLORE CHAMAK",
  },
  story: {
    heading: "Over 15 Years of Craftsmanship & Timeless Design",
    body:
      "BANSAL NX has been redefining women's fashion for over 15 years with a commitment to quality, craftsmanship, and timeless design. As a manufacturer of premium ethnic and contemporary wear, we create collections that combine elegance, comfort, and evolving fashion trends. To extend our design philosophy to a wider audience, we introduced CHAMAK, a premium women's fashion brand that celebrates Indian craftsmanship with a contemporary design approach. Every CHAMAK collection is thoughtfully created to deliver exceptional quality, elegance, and style for today's modern woman.",
    cta: "ABOUT US",
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
    image?: string;
    eyebrow: string;
    heading: string;
    subheading: string;
    primaryCta: string;
    secondaryCta: string;
  };
  editorial: { image?: string; heading: string; caption: string; cta: string };
  promo: { image?: string; heading: string; caption: string; cta: string };
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
