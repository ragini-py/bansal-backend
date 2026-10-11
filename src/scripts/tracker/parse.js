import fs from "node:fs";

const html = fs.readFileSync("e:/kbc-kolkatabusinessclub/backend/src/scripts/tracker/IMAGES.html", "utf-8");

// Parse rows
const rows = html.split(/<tr style="height: 20px">/);
console.log(`Total rows: ${rows.length}`);

const items = [];
for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  const slMatch = r.match(/<td class="s2"[^>]*>(\d+)<\/td>/);
  if (!slMatch) continue;
  const sl = parseInt(slMatch[1], 10);
  const imgMatch = r.match(/src="resources\/([^"]+)"/);
  const img = imgMatch ? imgMatch[1] : null;
  const nameMatch = r.match(/BANSAL\([^)]+\)|\b\d{4,5}\b/);
  const name = nameMatch ? nameMatch[0] : null;
  
  items.push({ sl, img, name, rowIdx: i });
}

console.log("Parsed items:", JSON.stringify(items, null, 2));
