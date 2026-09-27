import "dotenv/config";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import { env } from "../config/env.js";

async function run() {
  console.log("=== Testing Database Connection ===");
  console.log("MongoDB URI:", env.mongoUri ? env.mongoUri.replace(/:([^:@]+)@/, ":****@") : "Not set");
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
    console.log("✓ MongoDB Connected successfully! readyState =", mongoose.connection.readyState);
    await mongoose.disconnect();
  } catch (err: any) {
    console.error("✗ MongoDB Connection failed:", err.message);
  }

  console.log("\n=== Testing SMTP Connection Configuration ===");
  if (!env.smtp) {
    console.log("✗ SMTP is not configured in env (env.smtp is null)");
  } else {
    console.log("SMTP Host:", env.smtp.host);
    console.log("SMTP Port:", env.smtp.port);
    console.log("SMTP User:", env.smtp.user);
    console.log("SMTP Secure:", env.smtp.secure);
    console.log("EMAIL From:", env.smtp.from);

    const transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
      connectionTimeout: 10000,
    });

    try {
      console.log("Verifying configured SMTP transport...");
      const result = await transporter.verify();
      console.log("✓ SMTP Transporter verified successfully!", result);
    } catch (err: any) {
      console.error("✗ SMTP Verification failed:", err.message);
    }
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test error:", err);
    process.exit(1);
  });
