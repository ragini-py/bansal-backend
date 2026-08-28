import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

const ORDER_STATUSES = [
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
] as const;

const PAYMENT_METHODS = ["razorpay", "cod"] as const;
const PAYMENT_STATUSES = ["pending", "processing", "paid", "failed", "cancelled", "refunded"] as const;
const REFUND_STATUSES = ["none", "initiated", "completed"] as const;
const RETURN_STATUSES = [
  "requested",
  "approved",
  "rejected",
  "pickup_scheduled",
  "returned",
  "refund_initiated",
  "refund_completed",
] as const;

const orderLineSchema = new Schema(
  {
    productId: { type: String, required: true },
    name: { type: String, required: true },
    image: { type: String, default: "" },
    slug: { type: String, required: true },
    size: { type: String, required: true },
    colour: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    mrp: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

// Snapshot at order time, not a live reference — matches the frontend's
// Address type but has no independent lifecycle once embedded in an order.
const orderAddressSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    line1: { type: String, required: true },
    locality: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false },
);

const paymentSchema = new Schema(
  {
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, required: true },
    amount: { type: Number, required: true },
    razorpayPaymentId: { type: String, default: null },
    transactionId: { type: String, default: null },
    paidAt: { type: Date, default: null },
    refundStatus: { type: String, enum: REFUND_STATUSES, default: "none" },
    refundAmount: { type: Number, default: 0 },
  },
  { _id: false },
);

const trackingEventSchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    label: { type: String, required: true },
    location: { type: String },
    at: { type: Date, required: true },
    note: { type: String },
  },
  { _id: false },
);

const shipmentSchema = new Schema(
  {
    courier: { type: String, default: null },
    awb: { type: String, default: null },
    shipmentId: { type: String, default: null },
    trackingUrl: { type: String, default: null },
    estimatedDelivery: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    ndrReason: { type: String, default: null },
    rto: { type: Boolean, default: false },
    events: { type: [trackingEventSchema], default: [] },
  },
  { _id: false },
);

const returnRequestSchema = new Schema(
  {
    status: { type: String, enum: RETURN_STATUSES, required: true },
    reason: { type: String, required: true },
    requestedAt: { type: Date, required: true },
    refundAmount: { type: Number, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    // Not a hard ref: checkout always requires auth today, but orders are
    // display-only historical records — no join is ever performed on this.
    userId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true },
    lines: { type: [orderLineSchema], default: [] },
    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    couponCode: { type: String, default: null },
    shippingFee: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    total: { type: Number, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: "confirmed" },
    payment: { type: paymentSchema, required: true },
    address: { type: orderAddressSchema, required: true },
    shipment: { type: shipmentSchema, default: () => ({}) },
    returnRequest: { type: returnRequestSchema, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type OrderDoc = HydratedDocument<InferSchemaType<typeof orderSchema>>;

export const Order = model("Order", orderSchema);
