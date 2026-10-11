import mongoose from "mongoose";

async function run() {
  await mongoose.connect("mongodb+srv://bansalnxindia_db_user:043o77sdz5ayds5S@cluster0.sxdyihx.mongodb.net/?appName=Cluster0");
  const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));
  const prods = await Product.find({}).sort({ slug: 1 }).lean();
  console.log(`Found ${prods.length} products:`);
  for (const p of prods) {
    console.log(`SLUG: ${p.slug} | NAME: ${p.name} | CAT: ${p.category} | COLOURS: ${JSON.stringify(p.colours)} | COLOR_OPT: ${JSON.stringify(p.colorOptions)} | IMAGES: ${p.images?.[0]}`);
  }
  await mongoose.disconnect();
}
run().catch(console.error);
