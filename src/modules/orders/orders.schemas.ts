import { z } from "zod";

// Field-for-field match with the frontend's Order type
// (bansalnx-regal-suite/src/data/types.ts).
const orderStatusEnum = z.enum([
  "confirmed",
  "processing",
  "packed",
  "ready_for_pickup",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "delivery_failed",
  "ndr",
  "rto",
  "lost",
]);

const orderLineSchema = z.object({
  productId: z.string().min(1),
  name: z.string().min(1),
  image: z.string(),
  slug: z.string().min(1),
  size: z.string().min(1),
  colour: z.string().min(1),
  quantity: z.number().int().min(1).max(10),
  price: z.number().min(0),
  mrp: z.number().min(0),
});
export type CreateOrderLineInput = z.infer<typeof orderLineSchema>;

const orderAddressSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  fullName: z.string().min(1),
  phone: z.string().min(1),
  line1: z.string().min(1),
  locality: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(1),
  country: z.string().min(1),
  isDefault: z.boolean(),
});

const paymentSchema = z.object({
  method: z.enum(["razorpay", "cod"]),
  status: z.enum(["pending", "processing", "paid", "failed", "cancelled", "refunded"]),
  amount: z.number().min(0),
  razorpayPaymentId: z.string().nullable(),
  transactionId: z.string().nullable(),
  paidAt: z.string().nullable(),
  refundStatus: z.enum(["none", "initiated", "completed"]),
  refundAmount: z.number(),
});

const trackingEventSchema = z.object({
  status: orderStatusEnum,
  label: z.string().min(1),
  location: z.string().optional(),
  at: z.string(),
  note: z.string().optional(),
});

const shipmentSchema = z.object({
  courier: z.string().nullable(),
  awb: z.string().nullable(),
  shipmentId: z.string().nullable(),
  trackingUrl: z.string().nullable(),
  estimatedDelivery: z.string().nullable(),
  attempts: z.number(),
  ndrReason: z.string().nullable(),
  rto: z.boolean(),
  events: z.array(trackingEventSchema),
});

const returnRequestSchema = z.object({
  status: z.enum([
    "requested",
    "approved",
    "rejected",
    "pickup_scheduled",
    "returned",
    "refund_initiated",
    "refund_completed",
  ]),
  reason: z.string().min(1),
  requestedAt: z.string(),
  refundAmount: z.number(),
});

const createOrderPaymentSchema = paymentSchema.partial().extend({
  method: z.enum(["razorpay", "cod"]),
});

// Sent by CheckoutPage's placeOrder. `userId` is deliberately NOT accepted
// from the client — the authenticated caller's own id is used instead. Line
// price/mrp, subtotal, discount, shippingFee, tax, and total are all
// re-derived server-side from live Product/Coupon/Settings data in
// orders.service.ts's createOrder — the client's numbers here are used only
// for the shape of the request, never trusted for the actual charge.
// `status`, and everything in `payment` besides `method`, plus `shipment`
// and `returnRequest`, are likewise accepted optionally for client compatibility
// and then discarded — a brand-new order is always built
// server-side as "confirmed" with a fresh payment/shipment record, so a
// tampered request can't mark itself paid/delivered/refunded before any
// real payment or fulfilment has happened.
export const createOrderSchema = z.object({
  customerName: z.string().min(1),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().min(1),
  lines: z.array(orderLineSchema).min(1),
  subtotal: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  couponCode: z.string().nullable().optional(),
  shippingFee: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  total: z.number().min(0).optional(),
  status: orderStatusEnum.optional(),
  payment: createOrderPaymentSchema,
  address: orderAddressSchema,
  shipment: shipmentSchema.optional(),
  returnRequest: returnRequestSchema.nullable().optional(),
});
export type CreateOrderInput = z.infer<typeof createOrderSchema>;

// Admin's generic partial patch (status change, shipment dispatch, return
// approval) — matches the frontend's updateOrder(id, patch: Partial<Order>).
export const updateOrderSchema = z
  .object({
    status: orderStatusEnum,
    shipment: shipmentSchema,
    returnRequest: returnRequestSchema.nullable(),
    // Optimistic-concurrency guard — the version the client last read (see
    // orders.service.ts's updateOrder). Optional so older/other callers that
    // never send it keep working exactly as before.
    version: z.number().int().min(0),
  })
  .partial();
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;

export const requestReturnSchema = z.object({
  reason: z.string().trim().min(1),
});
export type RequestReturnInput = z.infer<typeof requestReturnSchema>;
