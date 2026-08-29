import type { Request, Response } from "express";
import type { AccessTokenPayload } from "../../utils/jwt.js";
import * as cartService from "./cart.service.js";
import type { ReplaceCartInput } from "./cart.schemas.js";

export async function get(req: Request, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const lines = await cartService.getCart(sub);
  res.json({ lines });
}

export async function replace(req: Request, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const lines = await cartService.replaceCart(sub, req.body as ReplaceCartInput);
  res.json({ lines });
}
