import type { Request, Response } from "express";
import { BadRequestError } from "../../common/app-error.js";
import * as uploadsService from "./uploads.service.js";

export async function upload(req: Request, res: Response): Promise<void> {
  if (!req.file) throw new BadRequestError("No image file was provided.");
  const url = await uploadsService.uploadImage(req.file);
  res.status(201).json({ url });
}
