import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";

const MONGODB_URI = "mongodb+srv://bansalnxindia_db_user:043o77sdz5ayds5S@cluster0.sxdyihx.mongodb.net/?appName=Cluster0";

// Already uploaded live URLs:
const uploadedUrls = [
  "/images/products/4866a8ad-fee1-4857-a22f-290f486447f8.jpg",
  "/images/products/80b05d41-e581-480e-9fcf-b19c50a74260.jpg",
  "/images/products/52b84d7d-a211-4882-9b6e-f6de72c2cc5c.jpg",
  "/images/products/31449f68-6d07-4f50-9120-1df1d56b67f0.jpg",
  "/images/products/de8a97d8-927b-4d0a-b308-168f5e371b5e.jpg",
];

async function main() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGODB_URI);
  console.log("✓ Connected to MongoDB Atlas!");

  const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));
  const Collection = mongoose.model("Collection", new mongoose.Schema({}, { strict: false }));

  const existing = await Product.findOne({ slug: "bansal-4018-sl-42" }).lean();
  if (existing) {
    console.log("Deleting existing product 42 doc...");
    await Product.deleteOne({ _id: existing._id });
  }

  const categoryId = new mongoose.Types.ObjectId("6ac22d7454eaaa98213d6209"); // Co-ord Sets

  const productData = {
    slug: "bansal-4018-sl-42",
    productCode: "4018",
    styleNumber: "4018",
    dressName: "BANSAL(4018)",
    name: "BANSAL(4018)",
    material: "Raw Silk & Tissue Zari",
    clothMaterial: "Raw Silk & Tissue Zari",
    price: 0,
    mrp: 6990,
    discountedPrice: 0,
    discountPercentage: 0,
    quantity: 0, // Out of stock
    currency: "INR",
    images: uploadedUrls,
    imagesByColour: {
      "Rani Pink": uploadedUrls,
    },
    category: "Co-ord Sets",
    categoryIds: [categoryId],
    collections: ["co-ord-sets"],
    tags: ["Co-ord Sets", "Raw Silk", "Zari", "Bansal", "Festive", "Sold Out"],
    badge: "exclusive",
    shortDescription: "Handcrafted Raw Silk Co-ord Set with Embellished Pockets · Bespoke Order",
    description:
      "BANSAL(4018) by Bansal-nx. Tailored raw silk tunic top featuring opulent hand-embroidered pocket detailing and split-sleeve accents, paired with tapered trousers trimmed in gold tissue zari borders. Currently sold out in ready-to-wear; available on bespoke custom order from our Jaipur studio.",
    details: [
      "Fabric: Pure Raw Silk with Gold Tissue Zari Border",
      "Work: Handcrafted Zardozi & Resham Pocket Detailing",
      "Fit: Structured Tunic Top & Tapered Trouser Set",
      "Origin: Handcrafted in Jaipur Studio",
      "Status: Out of Stock / Available on Bespoke Order",
    ],
    care: [
      "Dry clean only",
      "Store in a breathable garment muslin bag",
      "Steam iron on reverse with low heat",
    ],
    sizes: ["38", "40", "42", "44"],
    colours: ["Rani Pink"],
    availableSizes: [], // Empty for out of stock
    colorOptions: ["Rani Pink"],
    additionalComment: "42nd product added as Out of Stock / Bespoke Order",
    variants: [
      { _id: new mongoose.Types.ObjectId(), size: "38", colour: "Rani Pink", availability: "unavailable" },
      { _id: new mongoose.Types.ObjectId(), size: "40", colour: "Rani Pink", availability: "unavailable" },
      { _id: new mongoose.Types.ObjectId(), size: "42", colour: "Rani Pink", availability: "unavailable" },
      { _id: new mongoose.Types.ObjectId(), size: "44", colour: "Rani Pink", availability: "unavailable" },
    ],
    featured: false,
    bestseller: false,
    newArrival: true,
    published: true,
    createdAt: new Date(),
  };

  const created = await Product.create(productData);
  console.log(`✓ Product created successfully! ID: ${created._id}`);

  // Add to Collection.productIds
  const col = await Collection.findOne({ slug: "co-ord-sets" });
  if (col) {
    const pIds = Array.isArray(col.productIds) ? col.productIds : [];
    if (!pIds.includes("bansal-4018-sl-42")) {
      pIds.push("bansal-4018-sl-42");
    }
    if (!pIds.includes(created._id.toString())) {
      pIds.push(created._id.toString());
    }
    await Collection.updateOne({ _id: col._id }, { productIds: pIds });
    console.log(`✓ Added to Collection "co-ord-sets"! Total productIds: ${pIds.length}`);
  }

  // Count total published products
  const count = await Product.countDocuments({ published: true });
  console.log(`Total published products in catalog now: ${count}`);

  await mongoose.disconnect();
  console.log("Done!");
}

main().catch(console.error);
