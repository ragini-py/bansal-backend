import fs from "node:fs";

const html = fs.readFileSync("e:/kbc-kolkatabusinessclub/backend/src/scripts/tracker/IMAGES.html", "utf-8");
const rows = html.split(/<tr style="height: 20px">/);
console.log("Total rows in IMAGES.html:", rows.length);

for (let i = 2; i < rows.length; i++) {
  const r = rows[i];
  const slMatch = r.match(/<td class="s2"[^>]*>(\d+)<\/td>/);
  if (slMatch && parseInt(slMatch[1]) >= 40) {
    console.log("Found SL:", slMatch[1]);
    console.log(r.replace(/<[^>]+>/g, " | "));
  }
}
