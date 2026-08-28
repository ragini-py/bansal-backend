import type { Request, Response } from "express";
import type { AccessTokenPayload } from "../../utils/jwt.js";
import * as addressesService from "./addresses.service.js";
import type { CreateAddressInput } from "./addresses.schemas.js";

export async function create(req: Request, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const user = await addressesService.addAddress(sub, req.body as CreateAddressInput);
  res.status(201).json({ user });
}

export async function remove(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const user = await addressesService.removeAddress(sub, req.params.id);
  res.json({ user });
}
