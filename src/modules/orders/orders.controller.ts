import type { Request, Response } from "express";
import type { AccessTokenPayload } from "../../utils/jwt.js";
import * as ordersService from "./orders.service.js";
import type { CreateOrderInput, RequestReturnInput, UpdateOrderInput } from "./orders.schemas.js";

export async function create(req: Request, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const order = await ordersService.createOrder(sub, req.body as CreateOrderInput);
  res.status(201).json({ order });
}

export async function listMine(req: Request, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const orders = await ordersService.listMyOrders(sub);
  res.json({ orders });
}

export async function listAll(_req: Request, res: Response): Promise<void> {
  const orders = await ordersService.listAllOrders();
  res.json({ orders });
}

export async function update(req: Request<{ id: string }>, res: Response): Promise<void> {
  const order = await ordersService.updateOrder(req.params.id, req.body as UpdateOrderInput);
  res.json({ order });
}

export async function requestReturn(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const order = await ordersService.requestReturn(req.params.id, sub, req.body as RequestReturnInput);
  res.json({ order });
}

export async function cancel(req: Request<{ id: string }>, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const order = await ordersService.cancelOrder(req.params.id, sub);
  res.json({ order });
}

export async function track(req: Request, res: Response): Promise<void> {
  const id = req.query.id as string | undefined;
  const email = req.query.email as string | undefined;
  // Both are required — an order id alone (a Mongo ObjectId, which embeds a
  // predictable timestamp rather than being fully random) must not be
  // enough on its own to pull someone else's name/phone/address/order
  // contents with no verification at all.
  if (!id || !email) {
    res.status(400).json({
      success: false,
      code: "BAD_REQUEST",
      message: "Order id and email are both required.",
    });
    return;
  }
  const order = await ordersService.trackOrder(id, email);
  res.json({ order });
}
