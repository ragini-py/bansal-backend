import type { Request, Response } from "express";
import * as catalogService from "./catalog.service.js";
import type { UpdateProductInput } from "./catalog.schemas.js";

export async function listProducts(_req: Request, res: Response): Promise<void> {
  const products = await catalogService.listProducts();
  res.json({ products });
}

export async function getProduct(req: Request<{ slug: string }>, res: Response): Promise<void> {
  const product = await catalogService.getProductBySlug(req.params.slug);
  res.json({ product });
}

export async function updateProduct(req: Request<{ id: string }>, res: Response): Promise<void> {
  const product = await catalogService.updateProduct(req.params.id, req.body as UpdateProductInput);
  res.json({ product });
}

export async function listCollections(_req: Request, res: Response): Promise<void> {
  const collections = await catalogService.listCollections();
  res.json({ collections });
}

export async function getCollection(req: Request<{ slug: string }>, res: Response): Promise<void> {
  const collection = await catalogService.getCollectionBySlug(req.params.slug);
  res.json({ collection });
}
