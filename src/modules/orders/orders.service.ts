import { ForbiddenError, NotFoundError } from "../../common/app-error.js";
import { Order, type OrderDoc } from "./models/order.model.js";
import type { CreateOrderInput, RequestReturnInput, UpdateOrderInput } from "./orders.schemas.js";

export interface PublicOrder {
  id: string;
  userId: string;
  customerName: string;
  email: string;
  phone: string;
  createdAt: string;
  lines: PlainLine[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shippingFee: number;
  tax: number;
  total: number;
  status: string;
  payment: unknown;
  address: unknown;
  shipment: unknown;
  returnRequest: unknown;
}

interface PlainLine {
  productId: string;
  name: string;
  image: string;
  slug: string;
  size: string;
  colour: string;
  quantity: number;
  price: number;
  mrp: number;
}

interface PlainOrder {
  userId: string;
  customerName: string;
  email: string;
  phone: string;
  lines: PlainLine[];
  subtotal: number;
  discount: number;
  couponCode: string | null;
  shippingFee: number;
  tax: number;
  total: number;
  status: string;
  payment: {
    method: string;
    status: string;
    amount: number;
    razorpayPaymentId: string | null;
    transactionId: string | null;
    paidAt: Date | null;
    refundStatus: string;
    refundAmount: number;
  };
  address: Record<string, unknown>;
  shipment: {
    courier: string | null;
    awb: string | null;
    shipmentId: string | null;
    trackingUrl: string | null;
    estimatedDelivery: Date | null;
    attempts: number;
    ndrReason: string | null;
    rto: boolean;
    events: { status: string; label: string; location?: string; at: Date; note?: string }[];
  };
  returnRequest: { status: string; reason: string; requestedAt: Date; refundAmount: number } | null;
}

// Matches frontend/src/data/types.ts's Order exactly. Goes through
// doc.toObject() first — reading Mongoose single-nested subdocuments
// (payment/shipment/returnRequest) directly off the hydrated document would
// leak internal Mongoose bookkeeping (`$__parent`, `_doc`, etc.) into the
// spread response.
export function toPublicOrder(doc: OrderDoc): PublicOrder {
  const o = doc.toObject() as unknown as PlainOrder;
  return {
    id: doc._id.toString(),
    userId: o.userId,
    customerName: o.customerName,
    email: o.email,
    phone: o.phone,
    createdAt: doc.createdAt.toISOString(),
    lines: o.lines,
    subtotal: o.subtotal,
    discount: o.discount,
    couponCode: o.couponCode ?? null,
    shippingFee: o.shippingFee,
    tax: o.tax,
    total: o.total,
    status: o.status,
    payment: { ...o.payment, paidAt: o.payment.paidAt ? o.payment.paidAt.toISOString() : null },
    address: o.address,
    shipment: {
      ...o.shipment,
      estimatedDelivery: o.shipment.estimatedDelivery ? o.shipment.estimatedDelivery.toISOString() : null,
      events: o.shipment.events.map((e) => ({ ...e, at: e.at.toISOString() })),
    },
    returnRequest: o.returnRequest
      ? { ...o.returnRequest, requestedAt: o.returnRequest.requestedAt.toISOString() }
      : null,
  };
}

export async function createOrder(userId: string, input: CreateOrderInput): Promise<PublicOrder> {
  const doc = await Order.create({ ...input, userId });
  return toPublicOrder(doc);
}

export async function listMyOrders(userId: string): Promise<PublicOrder[]> {
  const docs = await Order.find({ userId }).sort({ createdAt: -1 });
  return docs.map(toPublicOrder);
}

export async function listAllOrders(): Promise<PublicOrder[]> {
  const docs = await Order.find().sort({ createdAt: -1 });
  return docs.map(toPublicOrder);
}

export async function updateOrder(id: string, patch: UpdateOrderInput): Promise<PublicOrder> {
  const doc = await Order.findById(id);
  if (!doc) throw new NotFoundError("Order not found.");
  doc.set(patch);
  await doc.save();
  return toPublicOrder(doc);
}

export async function requestReturn(
  id: string,
  userId: string,
  input: RequestReturnInput,
): Promise<PublicOrder> {
  const doc = await Order.findById(id);
  if (!doc) throw new NotFoundError("Order not found.");
  if (doc.userId !== userId) throw new ForbiddenError("This isn't your order.");

  doc.returnRequest = {
    status: "requested",
    reason: input.reason,
    requestedAt: new Date(),
    refundAmount: doc.total,
  };
  await doc.save();
  return toPublicOrder(doc);
}

export async function trackOrder(id: string, email: string): Promise<PublicOrder> {
  const doc = await Order.findById(id).catch(() => null);
  if (!doc || doc.email !== email.trim().toLowerCase()) {
    throw new NotFoundError("We couldn't find an order matching those details.");
  }
  return toPublicOrder(doc);
}
