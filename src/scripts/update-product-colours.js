import mongoose from "mongoose";

const COLOUR_MAP_BY_SL = {
  1: "Teal Blue",
  2: "Rust Orange",
  3: "Sage Green",
  4: "Pista Green",
  5: "Wine",
  6: "Rani Pink",
  7: "Mustard Yellow",
  8: "Fuchsia Pink",
  9: "Blush Pink",
  10: "Purple",
  11: "Black",
  12: "Royal Blue",
  13: "Wine",
  14: "Sky Blue",
  15: "Lime Green",
  16: "Navy Blue",
  17: "Crimson Red",
  18: "Ivory",
  19: "Powder Blue",
  20: "Teal Blue",
  21: "Copper Gold",
  22: "Lemon Yellow",
  23: "Charcoal Grey",
  24: "Mustard Yellow",
  25: "White",
  26: "Mustard Yellow",
  27: "Tangerine Orange",
  28: "Sky Blue",
  29: "Black",
  30: "Peach",
  31: "Cerulean Blue",
  32: "Purple",
  33: "Rani Pink",
  34: "Lavender",
  35: "Teal Blue",
  36: "Rust Orange",
  37: "Purple",
  38: "Rani Pink",
  39: "Rani Pink",
  40: "Crimson Red",
  41: "Rani Pink",
};

async function updateAllProducts() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(
    "mongodb+srv://bansalnxindia_db_user:043o77sdz5ayds5S@cluster0.sxdyihx.mongodb.net/?appName=Cluster0"
  );
  console.log("Connected to MongoDB!");

  const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));
  const prods = await Product.find({}).lean();
  console.log(`Fetched ${prods.length} total products in database.`);

  let updatedCount = 0;

  for (const p of prods) {
    const slMatch = p.slug.match(/-sl-(\d+)$/);
    if (!slMatch) {
      console.warn(`Product slug does not match -sl- pattern: ${p.slug}`);
      continue;
    }
    const sl = parseInt(slMatch[1], 10);
    const targetColour = COLOUR_MAP_BY_SL[sl];
    if (!targetColour) {
      console.warn(`No color defined for SL #${sl} (${p.slug})`);
      continue;
    }

    const colours = [targetColour];
    const colorOptions = [targetColour];
    const currentImgs = Array.isArray(p.images) && p.images.length > 0 ? p.images : [];
    const imagesByColour = {
      [targetColour]: currentImgs,
    };

    const sizeSeen = new Set();
    const updatedVariants = [];
    if (Array.isArray(p.variants) && p.variants.length > 0) {
      for (const v of p.variants) {
        const sz = v.size;
        if (!sizeSeen.has(sz)) {
          sizeSeen.add(sz);
          updatedVariants.push({
            size: sz,
            colour: targetColour,
            availability: v.availability || "available",
          });
        }
      }
    } else if (Array.isArray(p.sizes) && p.sizes.length > 0) {
      for (const s of p.sizes) {
        updatedVariants.push({
          size: s,
          colour: targetColour,
          availability: "available",
        });
      }
    }

    await Product.updateOne(
      { _id: p._id },
      {
        $set: {
          colours,
          colorOptions,
          imagesByColour,
          variants: updatedVariants,
        },
      }
    );

    updatedCount++;
    console.log(`✓ Updated [SL #${sl}] ${p.slug} (${p.name}) -> "${targetColour}"`);
  }

  console.log(`\nSuccessfully updated all ${updatedCount} products!`);

  // Verify distinct colours across entire catalog in DB
  const reloaded = await Product.find({ published: true }, { colours: 1, name: 1, slug: 1 }).lean();
  const distinctColours = Array.from(new Set(reloaded.flatMap((p) => p.colours || []))).sort();
  console.log("\nDistinct active colours in published catalog:", distinctColours);

  // Check if any "Default" or "Colour Option" remains anywhere
  const remainingGeneric = await Product.find({
    $or: [
      { colours: { $regex: /option|default/i } },
      { colorOptions: { $regex: /option|default/i } },
      { "variants.colour": { $regex: /option|default/i } },
    ],
  }).lean();
  console.log(`Remaining generic/placeholder colors in DB: ${remainingGeneric.length}`);

  await mongoose.disconnect();
  console.log("Done!");
}

updateAllProducts().catch(console.error);
