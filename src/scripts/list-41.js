import mongoose from "mongoose";

async function run() {
  await mongoose.connect("mongodb+srv://bansalnxindia_db_user:043o77sdz5ayds5S@cluster0.sxdyihx.mongodb.net/?appName=Cluster0");
  const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));
  const prods = await Product.find({}).lean();
  
  for (let i = 1; i <= 41; i++) {
    const p = prods.find(item => item.slug.endsWith(`-sl-${i}`));
    if (!p) {
      console.log(`SL #${i}: NOT FOUND`);
      continue;
    }
    console.log(`SL #${i} | ${p.name} | ${p.slug} | Cat: ${p.category} | Colours: ${JSON.stringify(p.colours)} | Img: https://bansalnx.in${p.images?.[0]}`);
  }
  await mongoose.disconnect();
}
run().catch(console.error);
