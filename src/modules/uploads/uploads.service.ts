import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../../config/env.js";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

let cloudinaryConfigured = false;
function configureCloudinary(): void {
  if (cloudinaryConfigured || !env.cloudinary) return;
  cloudinary.config({
    cloud_name: env.cloudinary.cloudName,
    api_key: env.cloudinary.apiKey,
    api_secret: env.cloudinary.apiSecret,
  });
  cloudinaryConfigured = true;
}

// Cloudinary when configured (see .env.example); otherwise local disk under
// backend/uploads, served statically at {APP_URL}/uploads/<file> (see
// app.ts) — the feature works fully with zero external setup, and upgrades
// to real cloud storage the moment CLOUDINARY_* is filled in.
//
// `sniffedExt` comes from the controller's magic-byte detection
// (file-type's fileTypeFromBuffer), never from file.mimetype — that header
// is client-supplied and trivially spoofed, so using it here would silently
// undo the point of sniffing the buffer in the first place.
export async function uploadImage(file: Express.Multer.File, sniffedExt: string): Promise<string> {
  if (env.cloudinary) {
    configureCloudinary();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "bansalnx", resource_type: "image" },
        (err, result) => {
          if (err || !result) reject(new Error(err?.message ?? "Cloudinary upload failed."));
          else resolve(result.secure_url);
        },
      );
      stream.end(file.buffer);
    });
  }

  await mkdir(UPLOADS_DIR, { recursive: true });
  const filename = `${randomUUID()}.${sniffedExt}`;
  await writeFile(path.join(UPLOADS_DIR, filename), file.buffer);
  return `${env.appUrl}/uploads/${filename}`;
}
