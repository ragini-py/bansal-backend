import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

// `sniffedExt` comes from the controller's magic-byte detection
// (file-type's fileTypeFromBuffer), never from file.mimetype — that header
// is client-supplied and trivially spoofed, so using it here would silently
// undo the point of sniffing the buffer in the first place.
export type UploadFolder = "products" | "collections" | "content" | "general";

const PUBLIC_IMAGES_DIR = path.join(process.cwd(), "public", "images");

export async function uploadImage(
  file: Express.Multer.File,
  sniffedExt: string,
  folder: UploadFolder,
): Promise<string> {
  const folderPath = path.join(PUBLIC_IMAGES_DIR, folder);
  await mkdir(folderPath, { recursive: true });
  const filename = `${randomUUID()}.${sniffedExt}`;
  await writeFile(path.join(folderPath, filename), file.buffer);
  return `/images/${folder}/${filename}`;
}
