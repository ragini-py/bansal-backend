import type { Request, Response } from "express";
import { requestMeta } from "../../common/request-meta.js";
import type { AccessTokenPayload } from "../../utils/jwt.js";
import * as couponsService from "./coupons.service.js";
import type { CreateCouponInput, ValidateCouponInput } from "./coupons.schemas.js";

// Admin-only — full listing including hidden/targeted codes (see routes).
export async function list(_req: Request, res: Response): Promise<void> {
  const coupons = await couponsService.listCoupons();
  res.json({ coupons });
}

// Public — only codes an admin marked isPublic, for a customer-facing
// "available offers" display. Never the full list.
export async function publicList(_req: Request, res: Response): Promise<void> {
  const coupons = await couponsService.listPublicCoupons();
  res.json({ coupons });
}

export async function validate(req: Request, res: Response): Promise<void> {
  const user = req.user;
  const sub = user?.sub ?? null;
  const { code, lines } = req.body as ValidateCouponInput;
  const result = await couponsService.validateCouponForCart(code, sub, lines);
  res.json(result);
}

export async function create(req: Request, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const coupon = await couponsService.createCoupon(req.body as CreateCouponInput, {
    id: sub,
    ...requestMeta(req),
  });
  res.status(201).json({ coupon });
}

export async function remove(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  await couponsService.deleteCoupon(req.params.id, { id: sub, ...requestMeta(req) });
  res.status(204).send();
}
