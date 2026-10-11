import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";

const API_BASE = "https://bansalnx.com/api";
const OPTIMIZED_DIR = "c:/Users/DEBANEEK SAHA/Downloads/bansal nx/optimized_final";
const PROGRESS_FILE = "c:/Users/DEBANEEK SAHA/Downloads/bansal nx/upload_progress.json";
const MONGODB_URI = "mongodb+srv://bansalnxindia_db_user:043o77sdz5ayds5S@cluster0.sxdyihx.mongodb.net/?appName=Cluster0";

let cachedToken = null;
let tokenExpiry = 0;

async function getAdminToken() {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }
  console.log("Authenticating as admin with live API...");
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "bansalnxindia@gmail.com",
      password: "Admin@12345",
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Admin login failed (${loginRes.status}): ${await loginRes.text()}`);
  }

  const data = await loginRes.json();
  cachedToken = data.accessToken;
  // 15 min TTL -> refresh after 10 min
  tokenExpiry = Date.now() + 10 * 60 * 1000;
  console.log("✓ Admin authenticated successfully!");
  return cachedToken;
}

async function uploadSingleImage(filePath, fileName, token, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: "image/jpeg" });
      const formData = new FormData();
      formData.append("image", blob, fileName);
      formData.append("folder", "products");

      const res = await fetch(`${API_BASE}/uploads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        return data.url;
      }

      console.warn(`Upload attempt ${attempt} for ${fileName} failed with status ${res.status}`);
      if (res.status === 401) {
        cachedToken = null;
        token = await getAdminToken();
      }
    } catch (err) {
      console.warn(`Upload attempt ${attempt} error for ${fileName}:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  throw new Error(`Failed to upload ${fileName} after ${maxRetries} attempts.`);
}

async function main() {
  console.log("==================================================================");
  console.log("Bansal NX: Live Catalog Image Matching & Synchronization");
  console.log("==================================================================\n");

  let token = await getAdminToken();

  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGODB_URI);
  console.log("✓ Connected to MongoDB Atlas!\n");

  const Product = mongoose.model("Product", new mongoose.Schema({}, { strict: false }));
  const dbProducts = await Product.find({}, { name: 1, slug: 1, images: 1 }).lean();
  console.log(`Loaded ${dbProducts.length} products from database.\n`);

  let progress = {};
  if (fs.existsSync(PROGRESS_FILE)) {
    try {
      progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
      console.log(`Loaded existing progress (${Object.keys(progress).length} products already processed).`);
    } catch {
      progress = {};
    }
  }

  for (let i = 1; i <= 41; i++) {
    const slKey = String(i);
    const prod = dbProducts.find((p) => p.slug.endsWith(`-sl-${i}`));
    if (!prod) {
      console.error(`✗ No product found in database for SL #${i}`);
      continue;
    }

    if (progress[slKey] && progress[slKey].completed) {
      console.log(`[SL #${i}/41] Skipping "${prod.name}" (already completed with ${progress[slKey].newImages.length} images).`);
      continue;
    }

    const folderPath = path.join(OPTIMIZED_DIR, String(i));
    if (!fs.existsSync(folderPath)) {
      console.error(`✗ Folder does not exist for SL #${i}: ${folderPath}`);
      continue;
    }

    const files = fs.readdirSync(folderPath);
    files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    console.log(`\n------------------------------------------------------------------`);
    console.log(`[SL #${i}/41] Processing "${prod.name}" (${prod.slug})`);
    console.log(`Current images: ${JSON.stringify(prod.images)}`);
    console.log(`Uploading ${files.length} new photos from Folder ${i}...`);

    const uploadedUrls = [];
    for (let fIdx = 0; fIdx < files.length; fIdx++) {
      const fileName = files[fIdx];
      const filePath = path.join(folderPath, fileName);
      token = await getAdminToken();
      const url = await uploadSingleImage(filePath, fileName, token);
      uploadedUrls.push(url);
      console.log(`  ✓ [${fIdx + 1}/${files.length}] Uploaded ${fileName} -> ${url}`);
    }

    // Update MongoDB: remove old images, set new uploaded URLs
    console.log(`Updating database for "${prod.name}" with ${uploadedUrls.length} images...`);
    await Product.updateOne(
      { _id: prod._id },
      { $set: { images: uploadedUrls } }
    );

    progress[slKey] = {
      completed: true,
      productId: prod._id.toString(),
      productName: prod.name,
      productSlug: prod.slug,
      oldImages: prod.images,
      newImages: uploadedUrls,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2), "utf-8");

    console.log(`✓ [SL #${i}/41] "${prod.name}" SUCCESS! Replaced old image with ${uploadedUrls.length} new images.`);
  }

  console.log("\n==================================================================");
  console.log("All 41 products processed! Performing live verification...");
  console.log("==================================================================\n");

  // Verify from live API
  const liveRes = await fetch(`${API_BASE}/products?limit=50`);
  const liveData = await liveRes.json();
  const liveProducts = liveData.items || liveData.products || [];
  console.log(`Live API returned ${liveProducts.length} products.`);

  let verifyPassed = 0;
  for (let i = 1; i <= 41; i++) {
    const p = liveProducts.find((item) => item.slug.endsWith(`-sl-${i}`));
    if (p && Array.isArray(p.images) && p.images.length >= 4) {
      verifyPassed++;
    } else {
      console.warn(`! Verification check warning for SL #${i}: images count = ${p?.images?.length}`);
    }
  }

  console.log(`Verification: ${verifyPassed}/41 products confirmed with >= 4 images on live API.`);
  await mongoose.disconnect();
}

main().catch(console.error);
