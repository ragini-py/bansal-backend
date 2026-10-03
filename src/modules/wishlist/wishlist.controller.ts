import type { Request, Response } from "express";
import type { AccessTokenPayload } from "../../utils/jwt.js";
import * as wishlistService from "./wishlist.service.js";
import type { ReplaceWishlistInput } from "./wishlist.schemas.js";

export async function get(req: Request, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const productIds = await wishlistService.getWishlist(sub);
  res.json({ productIds });
}

export async function replace(req: Request, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const productIds = await wishlistService.replaceWishlist(sub, req.body as ReplaceWishlistInput);
  res.json({ productIds });
}

export async function addProduct(req: Request<{ productId: string }>, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const productIds = await wishlistService.addToWishlist(sub, req.params.productId);
  res.json({ productIds });
}

export async function removeProduct(req: Request<{ productId: string }>, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const productIds = await wishlistService.removeFromWishlist(sub, req.params.productId);
  res.json({ productIds });
}
