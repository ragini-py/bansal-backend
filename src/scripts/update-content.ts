import "dotenv/config";
import { connectDb, disconnectDb } from "../db/connect.js";
import { Content } from "../modules/content/models/content.model.js";

async function run() {
  await connectDb();
  console.log("Connected to MongoDB, updating content document...");

  const update = {
    announcement: {
      enabled: true,
      text: "Bansal NX · 15+ Years of Manufacturing Excellence · Serving 1,000+ Retailers Across India & Overseas",
    },
    hero: {
      image: "",
      eyebrow: "15+ Years of Experience",
      heading: "Redefining Women's Fashion",
      subheading:
        "Manufacturer of premium ethnic & contemporary wear in Kolkata. Combining elegance, comfort, and evolving fashion trends.",
      primaryCta: "SHOP NOW",
      secondaryCta: "ABOUT US",
    },
    editorial: {
      image: "",
      heading: "CRAFTED FOR THE EXTRAORDINARY YOU",
      caption:
        "Every collection reflects confidence, individuality, and refined style — from design and manufacturing to the finished garment.",
      cta: "DISCOVER THE COLLECTION",
    },
    promo: {
      image: "",
      heading: "INTRODUCING CHAMAK — BY BANSAL NX",
      caption:
        "A premium women's fashion brand celebrating Indian craftsmanship with a contemporary design approach for today's modern woman.",
      cta: "EXPLORE CHAMAK",
    },
    story: {
      heading: "Over 15 Years of Craftsmanship & Timeless Design",
      body:
        "BANSAL NX has been redefining women's fashion for over 15 years with a commitment to quality, craftsmanship, and timeless design. As a manufacturer of premium ethnic and contemporary wear, we create collections that combine elegance, comfort, and evolving fashion trends. To extend our design philosophy to a wider audience, we introduced CHAMAK, a premium women's fashion brand that celebrates Indian craftsmanship with a contemporary design approach. Every CHAMAK collection is thoughtfully created to deliver exceptional quality, elegance, and style for today's modern woman.",
      cta: "ABOUT US",
    },
  };

  const result = await Content.findOneAndUpdate(
    { singleton: true },
    { $set: update },
    { new: true, upsert: true }
  );

  console.log("Updated content document in MongoDB:", result);
  await disconnectDb();
  process.exit(0);
}

run().catch((err) => {
  console.error("Error updating content:", err);
  process.exit(1);
});
