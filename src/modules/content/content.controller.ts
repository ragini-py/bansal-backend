import type { Request, Response } from "express";
import * as contentService from "./content.service.js";
import type { UpdateContentInput } from "./content.schemas.js";

export async function get(_req: Request, res: Response): Promise<void> {
  const content = await contentService.getContent();
  res.json({ content });
}

export async function update(req: Request, res: Response): Promise<void> {
  const content = await contentService.updateContent(req.body as UpdateContentInput);
  res.json({ content });
}
