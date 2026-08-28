/**
 * One-time / re-runnable seed for Product and Collection, migrating the
 * frontend's mock catalog (bansalnx-regal-suite/src/data/catalog.ts) into
 * MongoDB. Upserts by slug, so it's safe to run again after edits here.
 *
 * Usage: npm run seed
 */
import "dotenv/config";
import { connectDb, disconnectDb } from "../db/connect.js";
import { Collection, Product } from "../modules/catalog/models/index.js";

const SIZES = ["XS", "S", "M", "L", "XL"];

function variants(colours: string[], unavailable: string[] = []) {
  return colours.flatMap((colour) =>
    SIZES.map((size) => ({
      size,
      colour,
      availability: unavailable.includes(`${colour}:${size}`) ? "unavailable" : "available",
    })),
  );
}

// mockId lets the collections below reference products by their original
// mock identity; translated to real Mongo _ids after products are inserted.
const productSeeds = [
  {
    mockId: "prd-1",
    slug: "blush-rosette-skirt-set",
    name: "Blush Rosette Skirt Set",
    price: 24900,
    mrp: 32500,
    images: ["/products/p1.jpg", "/products/p5.jpg", "/products/p3.jpg"],
    category: "Skirt Sets",
    collections: ["the-ceremony-edit", "new-season"],
    tags: ["hand-embroidered", "festive", "pastel"],
    badge: "new",
    shortDescription: "Hand-embroidered blush organza skirt set with fine gold thread work.",
    description:
      "A study in restraint. The Blush Rosette skirt set is crafted from feather-light organza and hand-embroidered with dense gold resham rosettes along the hem. Paired with a structured blouse and a whisper-soft dupatta, it is made for celebrations that ask for elegance rather than volume.",
    details: [
      "Hand-embroidered organza with resham and sequin work",
      "Structured blouse with concealed hook fastening",
      "Includes skirt, blouse and dupatta",
      "Made to order in our Jaipur studio",
    ],
    care: ["Dry clean only", "Store in the muslin bag provided", "Avoid direct sunlight and perfume"],
    sizes: SIZES,
    colours: ["Blush", "Ivory"],
    variants: variants(["Blush", "Ivory"], ["Blush:M", "Ivory:XL", "Ivory:XS"]),
    featured: true,
    bestseller: true,
    newArrival: true,
    published: true,
  },
  {
    mockId: "prd-2",
    slug: "emerald-zari-anarkali",
    name: "Emerald Zari Anarkali",
    price: 38900,
    mrp: 46000,
    images: ["/products/p2.jpg", "/products/p6.jpg", "/products/p1.jpg"],
    category: "Gowns",
    collections: ["the-ceremony-edit", "heritage-classics"],
    tags: ["silk", "zari", "wedding"],
    badge: "bestseller",
    shortDescription: "Pure silk anarkali with a hand-woven zari border.",
    description:
      "Cut from pure mulberry silk in deep emerald, this anarkali falls in a single uninterrupted sweep. The border is hand-woven zari, drawn from an archival Banarasi motif and re-scaled for a modern silhouette.",
    details: [
      "Pure mulberry silk with hand-woven zari border",
      "Full-flare anarkali with side pockets",
      "Includes anarkali and matching stole",
      "Model is 5'9\" and wears size S",
    ],
    care: ["Dry clean only", "Iron on reverse at low heat"],
    sizes: SIZES,
    colours: ["Emerald"],
    variants: variants(["Emerald"], ["Emerald:XS", "Emerald:XL"]),
    featured: true,
    bestseller: true,
    newArrival: false,
    published: true,
  },
  {
    mockId: "prd-3",
    slug: "champagne-tissue-saree",
    name: "Champagne Tissue Saree",
    price: 21500,
    mrp: 21500,
    images: ["/products/p3.jpg", "/products/p1.jpg", "/products/p2.jpg"],
    category: "Sarees",
    collections: ["new-season", "heritage-classics"],
    tags: ["tissue", "gold", "minimal"],
    badge: "exclusive",
    shortDescription: "Liquid-gold tissue saree with a hand-finished selvedge.",
    description:
      "Woven on a handloom in Chanderi, this tissue saree catches light like poured metal. Deliberately unembellished, it is finished with a narrow gold selvedge and a slub-textured pallu.",
    details: [
      "Handloom tissue with gold zari selvedge",
      "6.3 metres with unstitched blouse piece",
      "Naturally slubbed texture; no two pieces are identical",
    ],
    care: ["Dry clean only", "Refold along different lines every few months"],
    sizes: ["Free Size"],
    colours: ["Champagne"],
    variants: [{ size: "Free Size", colour: "Champagne", availability: "available" }],
    featured: true,
    bestseller: false,
    newArrival: true,
    published: true,
  },
  {
    mockId: "prd-4",
    slug: "royal-velvet-lehenga",
    name: "Royal Velvet Lehenga",
    price: 74900,
    mrp: 92000,
    images: ["/products/p4.jpg", "/products/p2.jpg", "/products/p6.jpg"],
    category: "Lehengas",
    collections: ["the-ceremony-edit"],
    tags: ["velvet", "bridal", "zardozi"],
    badge: "bestseller",
    shortDescription: "Zardozi-embroidered velvet lehenga for the wedding hour.",
    description:
      "Nine metres of silk velvet, hand-embroidered over four hundred hours in gold zardozi and antique sequins. A ceremonial piece, weighted and lined so that it moves with you rather than against you.",
    details: [
      "Silk velvet with hand zardozi and dabka work",
      "Canvassed waistband with adjustable drawstring",
      "Includes lehenga, blouse and net dupatta",
      "Made to order; 4-6 weeks",
    ],
    care: ["Dry clean by specialist only", "Store flat, never on a hanger"],
    sizes: SIZES,
    colours: ["Royal Purple"],
    variants: variants(["Royal Purple"], ["Royal Purple:M", "Royal Purple:XL"]),
    featured: true,
    bestseller: true,
    newArrival: false,
    published: true,
  },
  {
    mockId: "prd-5",
    slug: "ivory-chikankari-kurta-set",
    name: "Ivory Chikankari Kurta Set",
    price: 14900,
    mrp: 18500,
    images: ["/products/p5.jpg", "/products/p3.jpg", "/products/p1.jpg"],
    category: "Kurta Sets",
    collections: ["new-season", "quiet-hours"],
    tags: ["chikankari", "cotton", "day"],
    badge: "new",
    shortDescription: "Hand-embroidered chikankari in mulmul cotton with pearl buttons.",
    description:
      "Lucknow chikankari at its most restrained: shadow-work vines across a mulmul kurta, finished with mother-of-pearl buttons. Designed for long afternoons and quiet celebrations.",
    details: [
      "Hand chikankari on mulmul cotton",
      "Includes kurta, straight trousers and dupatta",
      "Mother-of-pearl buttons",
    ],
    care: ["Gentle hand wash in cold water", "Dry in shade"],
    sizes: SIZES,
    colours: ["Ivory", "Pearl Grey"],
    variants: variants(["Ivory", "Pearl Grey"], ["Pearl Grey:S", "Pearl Grey:M"]),
    featured: false,
    bestseller: true,
    newArrival: true,
    published: true,
  },
  {
    mockId: "prd-6",
    slug: "teal-organza-sharara",
    name: "Teal Organza Sharara",
    price: 29900,
    mrp: 34900,
    images: ["/products/p6.jpg", "/products/p4.jpg", "/products/p2.jpg"],
    category: "Skirt Sets",
    collections: ["new-season", "quiet-hours"],
    tags: ["organza", "sequin", "evening"],
    badge: null,
    shortDescription: "Sequinned organza sharara set in deep peacock teal.",
    description:
      "Peacock teal organza, scattered with hand-set gold sequins that read as texture rather than sparkle. The sharara is generously cut and lined in cotton voile for comfort through long evenings.",
    details: [
      "Hand-set sequin and cutdana work on organza",
      "Cotton voile lining",
      "Includes blouse, sharara and cape dupatta",
    ],
    care: ["Dry clean only", "Handle sequins with care"],
    sizes: SIZES,
    colours: ["Peacock Teal"],
    variants: variants(["Peacock Teal"], ["Peacock Teal:XS"]),
    featured: false,
    bestseller: false,
    newArrival: true,
    published: true,
  },
  {
    mockId: "prd-7",
    slug: "sapphire-silk-gown",
    name: "Sapphire Silk Gown",
    price: 44900,
    mrp: 52000,
    images: ["/products/p2.jpg", "/products/p4.jpg", "/products/p3.jpg"],
    category: "Gowns",
    collections: ["quiet-hours", "heritage-classics"],
    tags: ["silk", "evening", "sapphire"],
    badge: "exclusive",
    shortDescription: "Bias-cut silk gown in deep sapphire with a draped shoulder.",
    description:
      "A bias-cut column in sapphire silk crepe with one softly draped shoulder. Unembellished by design — the fall of the fabric is the ornament.",
    details: ["Bias-cut silk crepe", "Concealed side zip", "Fully lined"],
    care: ["Dry clean only"],
    sizes: SIZES,
    colours: ["Sapphire"],
    variants: variants(["Sapphire"], ["Sapphire:L", "Sapphire:XL"]),
    featured: true,
    bestseller: false,
    newArrival: false,
    published: true,
  },
  {
    mockId: "prd-8",
    slug: "gilded-jacket-saree",
    name: "Gilded Jacket Saree",
    price: 56900,
    mrp: 68000,
    images: ["/products/p3.jpg", "/products/p6.jpg", "/products/p5.jpg"],
    category: "Sarees",
    collections: ["the-ceremony-edit", "heritage-classics"],
    tags: ["saree", "jacket", "gold"],
    badge: "bestseller",
    shortDescription: "Pre-draped gold saree with a hand-embroidered structured jacket.",
    description:
      "A pre-draped tissue saree worn under a sharply tailored, hand-embroidered jacket. Ceremonial dressing, simplified to a single step.",
    details: [
      "Pre-draped tissue saree with concealed fastening",
      "Hand-embroidered jacket with canvassed shoulders",
      "Includes saree, stitched blouse and jacket",
    ],
    care: ["Dry clean only", "Store jacket on a padded hanger"],
    sizes: SIZES,
    colours: ["Antique Gold"],
    variants: variants(["Antique Gold"], ["Antique Gold:XS", "Antique Gold:M"]),
    featured: false,
    bestseller: true,
    newArrival: false,
    published: true,
  },
  {
    mockId: "prd-9",
    slug: "pearl-grey-draped-set",
    name: "Pearl Grey Draped Set",
    price: 19900,
    mrp: 24500,
    images: ["/products/p5.jpg", "/products/p1.jpg", "/products/p6.jpg"],
    category: "Kurta Sets",
    collections: ["quiet-hours"],
    tags: ["drape", "minimal", "day"],
    badge: null,
    shortDescription: "Softly draped kurta set in pearl grey crepe.",
    description:
      "A fluid, asymmetrically draped kurta in pearl grey crepe with tonal thread detailing at the neckline. Understated enough for daylight, considered enough for evening.",
    details: ["Draped crepe kurta with tonal embroidery", "Includes kurta and tapered trousers"],
    care: ["Dry clean recommended"],
    sizes: SIZES,
    colours: ["Pearl Grey"],
    variants: variants(["Pearl Grey"], ["Pearl Grey:XL"]),
    featured: false,
    bestseller: false,
    newArrival: true,
    published: true,
  },
  {
    mockId: "prd-10",
    slug: "leaf-green-brocade-lehenga",
    name: "Leaf Green Brocade Lehenga",
    price: 49900,
    mrp: 61000,
    images: ["/products/p4.jpg", "/products/p6.jpg", "/products/p2.jpg"],
    category: "Lehengas",
    collections: ["the-ceremony-edit", "new-season"],
    tags: ["brocade", "festive"],
    badge: "new",
    shortDescription: "Handloom brocade lehenga in leaf green with a scalloped hem.",
    description:
      "Handloom brocade woven with a repeating botanical motif, cut into a full lehenga with a scalloped, zari-bound hem. Weighted for movement, kept clean at the waist.",
    details: ["Handloom brocade with zari-bound scalloped hem", "Includes lehenga, blouse, dupatta"],
    care: ["Dry clean only"],
    sizes: SIZES,
    colours: ["Leaf Green"],
    variants: variants(["Leaf Green"], ["Leaf Green:XS", "Leaf Green:L"]),
    featured: false,
    bestseller: false,
    newArrival: true,
    published: true,
  },
  {
    mockId: "prd-11",
    slug: "antique-rose-tulle-gown",
    name: "Antique Rose Tulle Gown",
    price: 61900,
    mrp: 72000,
    images: ["/products/p1.jpg", "/products/p4.jpg", "/products/p3.jpg"],
    category: "Gowns",
    collections: ["quiet-hours", "the-ceremony-edit"],
    tags: ["tulle", "couture"],
    badge: "exclusive",
    shortDescription: "Layered tulle gown with hand-appliquéd rose petals.",
    description:
      "Eleven layers of antique rose tulle, hand-appliquéd with silk petals that thin as they climb. A couture piece, entirely made to measure.",
    details: ["Eleven-layer silk tulle", "Hand-appliquéd petals", "Made to measure; 6-8 weeks"],
    care: ["Specialist dry clean only"],
    sizes: SIZES,
    colours: ["Antique Rose"],
    variants: variants(["Antique Rose"], ["Antique Rose:XS", "Antique Rose:S"]),
    featured: false,
    bestseller: false,
    newArrival: false,
    published: true,
  },
  {
    mockId: "prd-12",
    slug: "ivory-gold-festive-set",
    name: "Ivory & Gold Festive Set",
    price: 27900,
    mrp: 33000,
    images: ["/products/p5.jpg", "/products/p2.jpg", "/products/p1.jpg"],
    category: "Kurta Sets",
    collections: ["new-season", "heritage-classics"],
    tags: ["festive", "gold", "ivory"],
    badge: null,
    shortDescription: "Ivory silk kurta set with gold gota borders.",
    description:
      "Ivory raw silk with hand-applied gota borders at the placket and hem. A calm answer to festive dressing, cut narrow and finished by hand.",
    details: ["Raw silk with hand gota work", "Includes kurta, churidar and organza dupatta"],
    care: ["Dry clean only"],
    sizes: SIZES,
    colours: ["Ivory"],
    variants: variants(["Ivory"], ["Ivory:M"]),
    featured: false,
    bestseller: false,
    newArrival: false,
    published: true,
  },
] as const;

const collectionSeeds = [
  {
    slug: "the-ceremony-edit",
    name: "The Ceremony Edit",
    description:
      "Weighted silks, hand zardozi and ceremonial colour — pieces made for the moments people photograph.",
    coverImage: "/collections/collection-1.jpg",
    bannerImage: "/collections/collection-1.jpg",
    mockProductIds: ["prd-1", "prd-2", "prd-4", "prd-8", "prd-10", "prd-11"],
    featured: true,
    published: true,
    order: 1,
  },
  {
    slug: "quiet-hours",
    name: "Quiet Hours",
    description: "Restrained silhouettes in crepe, tulle and mulmul for evenings that need no announcement.",
    coverImage: "/collections/collection-2.jpg",
    bannerImage: "/collections/collection-2.jpg",
    mockProductIds: ["prd-5", "prd-6", "prd-7", "prd-9", "prd-11"],
    featured: true,
    published: true,
    order: 2,
  },
  {
    slug: "heritage-classics",
    name: "Heritage Classics",
    description: "Archival weaves reinterpreted with our karigars — handloom brocade, tissue and Banarasi zari.",
    coverImage: "/collections/collection-3.jpg",
    bannerImage: "/collections/collection-3.jpg",
    mockProductIds: ["prd-2", "prd-3", "prd-7", "prd-8", "prd-12"],
    featured: true,
    published: true,
    order: 3,
  },
  {
    slug: "new-season",
    name: "New Season",
    description: "The latest arrivals from our workshop, added weekly.",
    coverImage: "/collections/collection-2.jpg",
    bannerImage: "/collections/collection-2.jpg",
    mockProductIds: ["prd-1", "prd-3", "prd-5", "prd-6", "prd-9", "prd-10", "prd-12"],
    featured: false,
    published: true,
    order: 4,
  },
] as const;

async function seed(): Promise<void> {
  await connectDb();

  const idByMockId = new Map<string, string>();
  for (const { mockId, ...fields } of productSeeds) {
    const doc = await Product.findOneAndUpdate(
      { slug: fields.slug },
      { $set: fields },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    idByMockId.set(mockId, doc._id.toString());
  }
  console.log(`Seeded ${productSeeds.length} products.`);

  for (const { mockProductIds, ...fields } of collectionSeeds) {
    const productIds = mockProductIds
      .map((mockId) => idByMockId.get(mockId))
      .filter((id): id is string => !!id);
    await Collection.findOneAndUpdate(
      { slug: fields.slug },
      { $set: { ...fields, productIds } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  console.log(`Seeded ${collectionSeeds.length} collections.`);

  await disconnectDb();
}

seed()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
