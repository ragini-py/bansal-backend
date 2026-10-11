import mongoose from "mongoose";

async function main() {
  await mongoose.connect("mongodb+srv://bansalnxindia_db_user:043o77sdz5ayds5S@cluster0.sxdyihx.mongodb.net/?appName=Cluster0");
  const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));
  const prods = await Product.find({}).lean();
  console.log(`Total products: ${prods.length}`);

  const items = [];
  for (let i = 1; i <= 41; i++) {
    const p = prods.find(x => x.slug && (x.slug.endsWith(`-sl-${i}`) || x.slug.includes(`-sl-${i}`)));
    if (p) {
      items.push({
        sl: i,
        slug: p.slug,
        name: p.name,
        category: p.category,
        colours: p.colours,
        colorOptions: p.colorOptions,
        firstImg: p.images?.[0]
      });
    } else {
      console.error(`Missing SL #${i}!`);
    }
  }

  console.log(JSON.stringify(items, null, 2));
  await mongoose.disconnect();
}

main().catch(console.error);
