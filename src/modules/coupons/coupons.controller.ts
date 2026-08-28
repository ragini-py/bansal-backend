import type { Request, Response } from "express";
import * as couponsService from "./coupons.service.js";
import type { CreateCouponInput } from "./coupons.schemas.js";

export async function list(_req: Request, res: Response): Promise<void> {
  const coupons = await couponsService.listCoupons();
  res.json({ coupons });
}

export async function create(req: Request, res: Response): Promise<void> {
  const coupon = await couponsService.createCoupon(req.body as CreateCouponInput);
  res.status(201).json({ coupon });
}

export async function remove(req: Request<{ id: string }>, res: Response): Promise<void> {
  await couponsService.deleteCoupon(req.params.id);
  res.status(204).send();
}
