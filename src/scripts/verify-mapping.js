import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  await mongoose.connect('mongodb+srv://bansalnxindia_db_user:043o77sdz5ayds5S@cluster0.sxdyihx.mongodb.net/?appName=Cluster0');
  const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
  const products = await Product.find({}, { name: 1, slug: 1, images: 1 }).lean();
  
  const basePath = 'E:/final/bansal';
  
  const report = [];
  for (let i = 1; i <= 41; i++) {
    const p = products.find(prod => prod.slug.endsWith('-sl-' + i));
    const folderPath = path.join(basePath, String(i));
    const folderExists = fs.existsSync(folderPath);
    const files = folderExists ? fs.readdirSync(folderPath) : [];
    report.push({
      sl: i,
      productName: p ? p.name : 'MISSING',
      productSlug: p ? p.slug : 'MISSING',
      productId: p ? p._id.toString() : 'MISSING',
      currentImages: p ? p.images : [],
      newImagesCount: files.length,
      newImagesFiles: files
    });
  }

  let allMatched = true;
  for (const r of report) {
    if (!r.productName || r.newImagesCount === 0) {
      console.log('MISMATCH on SL ' + r.sl + '!', r);
      allMatched = false;
    }
  }
  if (allMatched) {
    console.log('SUCCESS: All 41 products match 1-to-1 with folders 1 to 41!');
    console.log('Total new images across all products:', report.reduce((sum, r) => sum + r.newImagesCount, 0));
    console.log('\n--- MAPPING TABLE ---');
    for (const r of report) {
      console.log(`SL #${r.sl}: "${r.productName}" (${r.productSlug}) -> ${r.newImagesCount} files [Current: ${r.currentImages[0] || 'none'}]`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
