import { fileTypeFromBuffer } from "file-type";
import type { Request, Response } from "express";
import { BadRequestError } from "../../common/app-error.js";
import * as uploadsService from "./uploads.service.js";

// Extension/declared-mimetype (checked by multer's fileFilter, see
// uploads.routes.ts) are just metadata the client attaches — trivially
// spoofed by renaming a .php file to .jpg. This sniffs the actual magic
// bytes so what's stored is provably an image, not whatever the request
// claimed it was.
const ALLOWED_IMAGE_TYPES = new Set(["jpg", "png", "webp", "gif"]);

export async function upload(req: Request, res: Response): Promise<void> {
  if (!req.file) throw new BadRequestError("No image file was provided.");

  const detected = await fileTypeFromBuffer(req.file.buffer);
  if (!detected || !ALLOWED_IMAGE_TYPES.has(detected.ext)) {
    throw new BadRequestError("That file doesn't look like a supported image (jpg, png, webp, gif).");
  }

  const url = await uploadsService.uploadImage(req.file);
  res.status(201).json({ url });
}
