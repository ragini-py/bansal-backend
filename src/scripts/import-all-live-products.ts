import pkg from "xlsx";
const { readFile, utils } = pkg;
import fs from "node:fs";
import path from "node:path";

const API_BASE = "https://bansalnx.com/api";
const xlsxPath = "E:\\Downloads\\bansal nx dress tracker.xlsx";
const optimizedImagesDir = "E:\\kbc-kolkatabusinessclub\\backend\\optimized_images";

interface ParsedItem {
  slNo: number;
  imageFile: string;
  name: string;
  code: string;
  shortDescription: string;
  category: string;
  clothMaterial: string;
  sizes: string[];
  colours: string[];
  mrp: number;
  price: number;
  discountPercentage: number;
  quantity: number;
  isOutOfStock: boolean;
  comment: string;
}

async function main() {
  console.log("=================================================");
  console.log("Bansal-nx Live Catalog Importer & Media Uploader");
  console.log("=================================================\n");

  // Step 1: Login
  console.log("1. Authenticating as Admin with Live API...");
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "bansalnxindia@gmail.com",
      password: "Admin@12345",
    }),
  });

  if (!loginRes.ok) {
    throw new Error(`Admin Login failed (${loginRes.status}): ${await loginRes.text()}`);
  }

  const { accessToken } = await loginRes.json();
  console.log("✓ Admin authenticated successfully!\n");

  // Step 2: Parse Workbook
  console.log("2. Reading and parsing Excel Dress Tracker...");
  const workbook = readFile(xlsxPath);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });

  const slIndices: { index: number; slNo: number; row: any[] }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const slNoVal = rows[i][0];
    if (typeof slNoVal === "number" || (typeof slNoVal === "string" && slNoVal.trim() && !isNaN(Number(slNoVal)))) {
      slIndices.push({ index: i, slNo: Number(slNoVal), row: rows[i] });
    }
  }

  const items: ParsedItem[] = [];

  for (let s = 0; s < slIndices.length; s++) {
    const current = slIndices[s];
    const nextIndex = s < slIndices.length - 1 ? slIndices[s + 1].index : rows.length;

    const topRow = current.row;
    const slNo = current.slNo;

    const name = String(topRow[2] || "").trim();
    const shortDesc = String(topRow[4] || topRow[3] || "").trim();
    const isOutOfStock = shortDesc.toUpperCase().includes("OUT OF STOCK");

    let dataRow: any[] = [];
    for (let r = current.index + 1; r < nextIndex; r++) {
      const candidate = rows[r];
      if (candidate[5] || candidate[6] || candidate[9]) {
        dataRow = candidate;
        break;
      }
    }

    const categoryRaw = String(dataRow[5] || "").trim().toUpperCase();
    const clothMaterial = String(dataRow[6] || "").trim();
    const sizesRaw = String(dataRow[7] || "").trim();
    const colourOptionsRaw = dataRow[8] || 1;
    let mrp = Number(dataRow[9]) || 0;
    let price = Number(dataRow[10]) || mrp;
    let discountPercentage = Number(dataRow[11]) || 0;
    let quantity = Number(dataRow[12]) || 10;
    const comment = String(dataRow[13] || "").trim();

    // Fix known typo: if price is 51110 for MRP 6390 (SL 11)
    if (price > mrp && mrp > 0) {
      price = Math.round(mrp * 0.8);
      discountPercentage = 20;
    }

    // Category mapping
    let category = "Indo-Western";
    if (categoryRaw.includes("SUIT")) category = "Suit with Dupatta";
    else if (categoryRaw.includes("CORD") || categoryRaw.includes("CORT")) category = "Co-ord Sets";
    else if (categoryRaw.includes("3PCS") || categoryRaw.includes("3 PCS")) category = "3-Piece Sets";
    else if (categoryRaw.includes("A-LINE") || categoryRaw.includes("A- LINE") || categoryRaw.includes("A LINE")) category = "A-Line Dresses";
    else if (categoryRaw.includes("TUNIC")) category = "Tunics";
    else if (categoryRaw.includes("JAMDANI")) category = "Jamdani Edit";
    else if (categoryRaw.includes("INDO") || categoryRaw.includes("IINDO")) category = "Indo-Western";

    // Size parsing
    let sizes = ["38", "40", "42", "44"];
    if (sizesRaw.includes("TO")) {
      const parts = sizesRaw.split(/TO/i).map(s => Number(s.trim())).filter(n => !isNaN(n));
      if (parts.length === 2) {
        const [start, end] = parts;
        sizes = [];
        for (let sz = start; sz <= end; sz += 2) {
          sizes.push(String(sz));
        }
      }
    } else if (sizesRaw.includes("-")) {
      const parts = sizesRaw.split("-").map(s => s.trim()).filter(Boolean);
      if (parts.length > 1) {
        sizes = parts;
      }
    }

    // Colours
    const colourCount = Number(colourOptionsRaw) || 1;
    let colours = ["Default"];
    if (colourCount > 1) {
      colours = Array.from({ length: colourCount }, (_, idx) => `Colour Option ${idx + 1}`);
    }

    const imageFile = `cellImage_0_${slNo - 1}.jpg`;

    items.push({
      slNo,
      imageFile,
      name: name ? name : `Bansal Creation #${slNo}`,
      code: name ? name.replace(/[^0-9]/g, "") || String(slNo) : String(slNo),
      shortDescription: isOutOfStock ? "Special couture piece (Currently Out of Stock)." : (shortDesc || "Handcrafted luxury piece by Bansal-nx."),
      category,
      clothMaterial: clothMaterial || "Pure Silk Blend",
      sizes,
      colours,
      mrp: mrp || 4990,
      price: price || (mrp ? Math.round(mrp * 0.8) : 3990),
      discountPercentage: discountPercentage || (mrp ? 20 : 0),
      quantity: isOutOfStock ? 0 : quantity,
      isOutOfStock,
      comment,
    });
  }

  console.log(`✓ Parsed ${items.length} products from Excel.\n`);

  // Step 3: Create Categories
  console.log("3. Ensuring categories exist in Live database...");
  const uniqueCategories = Array.from(new Set(items.map(i => i.category)));
  const categoryMap = new Map<string, string>(); // name -> id

  for (const catName of uniqueCategories) {
    const catRes = await fetch(`${API_BASE}/categories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: catName }),
    });

    if (catRes.ok) {
      const data = await catRes.json();
      categoryMap.set(catName, data.category.id);
      console.log(`  ✓ Category ready: "${catName}" (ID: ${data.category.id})`);
    } else {
      console.warn(`  ! Could not create category "${catName}" (${catRes.status})`);
    }
  }

  // Step 4: Upload images and create products
  console.log("\n4. Uploading images & creating products in live catalog...");
  let createdCount = 0;
  let failedCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const imagePath = path.join(optimizedImagesDir, item.imageFile);

    let imageUrl = "/images/products/placeholder.jpg";

    if (fs.existsSync(imagePath)) {
      try {
        const fileBuffer = fs.readFileSync(imagePath);
        const blob = new Blob([fileBuffer], { type: "image/jpeg" });
        const formData = new FormData();
        formData.append("image", blob, item.imageFile);
        formData.append("folder", "products");

        const uploadRes = await fetch(`${API_BASE}/uploads`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        });

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          imageUrl = uploadData.url;
        } else {
          console.warn(`  ! Image upload warning for SL #${item.slNo} (${uploadRes.status})`);
        }
      } catch (err) {
        console.warn(`  ! Image upload error for SL #${item.slNo}:`, err);
      }
    }

    // Build variants
    const variants = [];
    for (const size of item.sizes) {
      for (const colour of item.colours) {
        variants.push({
          size,
          colour,
          availability: item.isOutOfStock ? "unavailable" : "available",
        });
      }
    }

    // Slug generation
    const baseSlug = item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const slug = `${baseSlug || "dress"}-sl-${item.slNo}`;

    const catId = categoryMap.get(item.category);

    const productPayload = {
      slug,
      productCode: item.code,
      styleNumber: item.code,
      dressName: item.name,
      name: item.name,
      material: item.clothMaterial,
      clothMaterial: item.clothMaterial,
      price: item.price,
      mrp: item.mrp,
      discountedPrice: item.price,
      discountPercentage: item.discountPercentage,
      quantity: item.quantity,
      currency: "INR",
      images: [imageUrl],
      category: item.category,
      categoryIds: catId ? [catId] : [],
      collections: ["the-ceremony-edit"],
      tags: [item.category, item.clothMaterial, "Bansal", "Festive"],
      badge: item.slNo <= 5 ? "new" : (item.discountPercentage >= 20 ? "exclusive" : null),
      shortDescription: item.shortDescription,
      description: `${item.name} by Bansal-nx. ${item.shortDescription} Crafted in luxurious ${item.clothMaterial}. Featuring intricate embroidery and regal styling tailored for celebratory occasions.`,
      details: [
        `Fabric: ${item.clothMaterial}`,
        `Style: ${item.shortDescription}`,
        `Sizes Available: ${item.sizes.join(", ")}`,
        `Origin: Handcrafted in Jaipur Studio`,
      ],
      care: [
        "Dry clean only",
        "Store in a breathable garment muslin bag",
        "Steam iron on reverse with low heat",
      ],
      sizes: item.sizes,
      colours: item.colours,
      availableSizes: item.sizes,
      colorOptions: item.colours,
      additionalComment: item.comment,
      variants,
      featured: item.slNo <= 8,
      bestseller: item.slNo % 4 === 0,
      newArrival: true,
      published: !item.isOutOfStock,
    };

    try {
      const createRes = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(productPayload),
      });

      if (createRes.ok) {
        const prodData = await createRes.json();
        createdCount++;
        console.log(`  [${i + 1}/${items.length}] ✓ Created SL #${item.slNo}: ${item.name} (${item.category} - ₹${item.price}) -> ID: ${prodData.product.id}`);
      } else {
        const errText = await createRes.text();
        failedCount++;
        console.error(`  [${i + 1}/${items.length}] ✗ Failed SL #${item.slNo}: ${item.name} (${createRes.status}): ${errText}`);
      }
    } catch (err) {
      failedCount++;
      console.error(`  [${i + 1}/${items.length}] ✗ Error creating SL #${item.slNo}:`, err);
    }
  }

  console.log("\n=================================================");
  console.log(`IMPORT FINISHED! Successfully created: ${createdCount}, Failed: ${failedCount}`);
  console.log("=================================================");
}

main().catch(console.error);
