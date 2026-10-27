import { ConflictError, ForbiddenError, NotFoundError } from "../../common/app-error.js";
import { env } from "../../config/env.js";
import { sendEmail } from "../../utils/email.js";
import {
  renderCustomerOrderConfirmedEmail,
  renderAdminNewOrderAlertEmail,
  renderCustomerOrderStatusUpdateEmail,
  renderAdminOrderStatusUpdateEmail,
  renderCustomerOrderCancelledEmail,
  renderAdminOrderCancelledEmail,
  type OrderEmailData,
} from "../../utils/email-templates.js";
import { type AuditActor, recordAudit } from "../audit/audit.service.js";
import { User } from "../auth/models/index.js";
import { Product } from "../catalog/models/index.js";
import { priceCoupon } from "../coupons/coupons.service.js";
import { Coupon } from "../coupons/models/coupon.model.js";
import { getPricingSettings, getSettings } from "../settings/settings.service.js";
import { Order, type OrderDoc } from "./models/order.model.js";
import type { CreateOrderInput, RequestReturnInput, UpdateOrderInput } from "./orders.schemas.js";

export interface PublicOrder {
  id: string;
  version: number;
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
    version: doc.__v,
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

function toOrderEmailData(doc: OrderDoc): OrderEmailData {
  const o = doc.toObject() as unknown as PlainOrder;
  const addr = (o.address || {}) as Record<string, unknown>;
  return {
    id: doc._id.toString(),
    customerName: o.customerName,
    email: o.email,
    phone: o.phone,
    lines: (o.lines || []).map((l) => ({
      name: l.name,
      size: l.size,
      colour: l.colour,
      quantity: l.quantity,
      price: l.price,
      image: l.image,
    })),
    subtotal: o.subtotal,
    discount: o.discount,
    shippingFee: o.shippingFee,
    total: o.total,
    status: o.status,
    payment: {
      method: String(o.payment?.method || "online"),
      status: String(o.payment?.status || "pending"),
      amount: Number(o.payment?.amount || o.total),
    },
    address: {
      fullName: typeof addr.fullName === "string" ? addr.fullName : o.customerName,
      phone: typeof addr.phone === "string" ? addr.phone : o.phone,
      line1: typeof addr.line1 === "string" ? addr.line1 : "",
      locality: typeof addr.locality === "string" ? addr.locality : "",
      city: typeof addr.city === "string" ? addr.city : "",
      state: typeof addr.state === "string" ? addr.state : "",
      pincode: typeof addr.pincode === "string" ? addr.pincode : "",
      country: typeof addr.country === "string" ? addr.country : "India",
    },
    shipment: {
      courier: o.shipment?.courier ?? null,
      awb: o.shipment?.awb ?? null,
      trackingUrl: o.shipment?.trackingUrl ?? null,
      estimatedDelivery: o.shipment?.estimatedDelivery ?? null,
    },
  };
}

async function getAdminNotificationEmails(): Promise<string[]> {
  const emails = new Set<string>();

  // 1. Explicit env configuration if provided
  if (process.env.ADMIN_NOTIFICATION_EMAIL) {
    process.env.ADMIN_NOTIFICATION_EMAIL.split(",").forEach((e) => {
      const trimmed = e.trim().toLowerCase();
      if (trimmed) emails.add(trimmed);
    });
  }
  if (process.env.ADMIN_EMAIL) {
    process.env.ADMIN_EMAIL.split(",").forEach((e) => {
      const trimmed = e.trim().toLowerCase();
      if (trimmed) emails.add(trimmed);
    });
  }

  // 2. Store settings support email
  try {
    const settings = await getSettings();
    if (settings.supportEmail) emails.add(settings.supportEmail.trim().toLowerCase());
  } catch {
    // Ignore settings fetch error
  }

  // 3. Registered Admin users in DB
  try {
    const adminDocs = await User.find({ role: "admin", status: "active" }).select("email").lean();
    for (const a of adminDocs) {
      if (a.email) emails.add(a.email.trim().toLowerCase());
    }
  } catch {
    // Ignore user lookup error
  }

  if (emails.size === 0) {
    emails.add("care@bansalnx.in");
  }

  return Array.from(emails);
}

async function notifyOrderPlaced(doc: OrderDoc): Promise<void> {
  const emailData = toOrderEmailData(doc);
  const trackingUrl = `${env.corsOrigin}/track?id=${encodeURIComponent(emailData.id)}&email=${encodeURIComponent(emailData.email)}`;
  const adminOrderUrl = `${env.corsOrigin}/admin`;

  // 1. Send confirmation to Customer
  try {
    const custEmail = renderCustomerOrderConfirmedEmail({ order: emailData, trackingUrl });
    await sendEmail({
      to: emailData.email,
      subject: custEmail.subject,
      html: custEmail.html,
      text: custEmail.text,
    });
  } catch (err) {
    console.error(`[email] Failed to send order confirmation to customer (${emailData.email}):`, err);
  }

  // 2. Send new order alert to Admin(s)
  try {
    const adminEmails = await getAdminNotificationEmails();
    const adminEmail = renderAdminNewOrderAlertEmail({ order: emailData, adminOrderUrl });
    for (const to of adminEmails) {
      await sendEmail({
        to,
        subject: adminEmail.subject,
        html: adminEmail.html,
        text: adminEmail.text,
      });
    }
  } catch (err) {
    console.error(`[email] Failed to send new order alert to admins:`, err);
  }
}

async function notifyOrderStatusUpdated(
  doc: OrderDoc,
  oldStatus: string,
  newStatus: string,
  actor: AuditActor,
): Promise<void> {
  const emailData = toOrderEmailData(doc);
  const trackingUrl = `${env.corsOrigin}/track?id=${encodeURIComponent(emailData.id)}&email=${encodeURIComponent(emailData.email)}`;
  const adminOrderUrl = `${env.corsOrigin}/admin`;
  const actorName = actor.id || "Store Admin";

  // 1. Notify Customer
  try {
    const custEmail = renderCustomerOrderStatusUpdateEmail({
      order: emailData,
      oldStatus,
      newStatus,
      trackingUrl,
    });
    await sendEmail({
      to: emailData.email,
      subject: custEmail.subject,
      html: custEmail.html,
      text: custEmail.text,
    });
  } catch (err) {
    console.error(`[email] Failed to send status update email to customer (${emailData.email}):`, err);
  }

  // 2. Notify Admin(s)
  try {
    const adminEmails = await getAdminNotificationEmails();
    const adminEmail = renderAdminOrderStatusUpdateEmail({
      order: emailData,
      oldStatus,
      newStatus,
      actorName,
      adminOrderUrl,
    });
    for (const to of adminEmails) {
      await sendEmail({
        to,
        subject: adminEmail.subject,
        html: adminEmail.html,
        text: adminEmail.text,
      });
    }
  } catch (err) {
    console.error(`[email] Failed to send status update email to admins:`, err);
  }
}

async function notifyOrderCancelled(
  doc: OrderDoc,
  reason: string,
  actor: AuditActor,
): Promise<void> {
  const emailData = toOrderEmailData(doc);
  const trackingUrl = `${env.corsOrigin}/track?id=${encodeURIComponent(emailData.id)}&email=${encodeURIComponent(emailData.email)}`;
  const adminOrderUrl = `${env.corsOrigin}/admin`;
  const actorName = actor.id || "Customer";

  // 1. Notify Customer
  try {
    const custEmail = renderCustomerOrderCancelledEmail({
      order: emailData,
      reason,
      trackingUrl,
    });
    await sendEmail({
      to: emailData.email,
      subject: custEmail.subject,
      html: custEmail.html,
      text: custEmail.text,
    });
  } catch (err) {
    console.error(`[email] Failed to send cancellation email to customer (${emailData.email}):`, err);
  }

  // 2. Notify Admin(s)
  try {
    const adminEmails = await getAdminNotificationEmails();
    const adminEmail = renderAdminOrderCancelledEmail({
      order: emailData,
      reason,
      actorName,
      adminOrderUrl,
    });
    for (const to of adminEmails) {
      await sendEmail({
        to,
        subject: adminEmail.subject,
        html: adminEmail.html,
        text: adminEmail.text,
      });
    }
  } catch (err) {
    console.error(`[email] Failed to send cancellation email to admins:`, err);
  }
}

export async function createOrder(
  userId: string,
  input: CreateOrderInput,
  idempotencyKey?: string,
): Promise<PublicOrder> {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("Account not found.");
  if (user.status === "blocked") {
    throw new ForbiddenError("This account has been suspended. Please contact us.");
  }

  if (idempotencyKey) {
    const existing = await Order.findOne({ userId, idempotencyKey });
    if (existing) return toPublicOrder(existing);
  }

  // Never trust client-sent price/mrp — re-price every line from the live
  // product record so a tampered request can't buy at an arbitrary price.
  const lines = await Promise.all(
    input.lines.map(async (line) => {
      const product = await Product.findById(line.productId).catch(() => null);
      if (!product) throw new NotFoundError(`Product ${line.productId} no longer exists.`);
      if (!product.published) {
        throw new ConflictError(`Product ${product.name} is not currently published and cannot be ordered.`);
      }

      const requestedSize = line.size.trim();
      const requestedColour = line.colour.trim();
      const sizeExists = product.sizes.some((size) => size.trim().toLowerCase() === requestedSize.toLowerCase());
      const colourExists = product.colours.some(
        (colour) => colour.trim().toLowerCase() === requestedColour.toLowerCase(),
      );
      if (!sizeExists) {
        throw new ConflictError(`Size ${requestedSize} is not available for ${product.name}.`);
      }
      if (!colourExists) {
        throw new ConflictError(`Colour ${requestedColour} is not available for ${product.name}.`);
      }

      const variant = product.variants.find(
        (item) =>
          item.size.trim().toLowerCase() === requestedSize.toLowerCase() &&
          item.colour.trim().toLowerCase() === requestedColour.toLowerCase(),
      );
      if (!variant) {
        throw new ConflictError(
          `The ${requestedColour} / ${requestedSize} variant is not available for ${product.name}.`,
        );
      }
      if (variant.availability !== "available") {
        throw new ConflictError(
          `The ${requestedColour} / ${requestedSize} variant for ${product.name} is currently unavailable.`,
        );
      }

      return {
        ...line,
        name: product.name,
        image: product.images[0] ?? line.image,
        slug: product.slug,
        price: product.price,
        mrp: product.mrp,
      };
    }),
  );
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);

  let discount = 0;
  let couponCode: string | null = null;
  if (input.couponCode) {
    const priced = await priceCoupon(input.couponCode, userId, subtotal, lines);
    couponCode = priced.couponCode;
    discount = priced.discount;
  }

  // Shipping/COD fee and eligibility re-derived from the live store
  // settings — matches store.tsx's totals() logic exactly, just server-side
  // so a tampered request can't get free shipping or bypass the COD cap.
  const settings = await getPricingSettings();
  const afterDiscount = Math.max(subtotal - discount, 0);
  const shippingFee =
    afterDiscount === 0 || afterDiscount >= settings.freeShippingThreshold ? 0 : settings.shippingFee;

  if (input.payment.method === "cod") {
    if (!settings.codEnabled) throw new ConflictError("Cash on Delivery isn't available right now.");
    if (afterDiscount + shippingFee > settings.codMaxOrderValue) {
      throw new ConflictError("Cash on Delivery isn't available for orders this large.");
    }
  }
  const codFee = input.payment.method === "cod" ? settings.codFee : 0;
  const tax = 0; // GST is included in listed prices — same as store.tsx's totals().
  const total = afterDiscount + shippingFee + codFee + tax;

  // Atomically claim a usage slot right before creating the order (not just
  // read-then-later-increment) — otherwise two checkouts racing near the
  // usage limit can both pass priceCoupon's read-only check and the coupon
  // ends up used more times than usageLimit allows. The $expr comparison
  // only matches (and increments) if there's still room.
  if (couponCode) {
    const claimed = await Coupon.findOneAndUpdate(
      {
        code: couponCode,
        $or: [{ usageLimit: null }, { $expr: { $lt: ["$timesUsed", "$usageLimit"] } }],
      },
      { $inc: { timesUsed: 1 } },
    );
    if (!claimed) throw new ConflictError("This coupon has reached its usage limit.");
  }

  // status/payment/shipment/returnRequest are never trusted from the client
  // at creation time — a tampered request could otherwise mark itself
  // "delivered" or "paid" with a fabricated razorpayPaymentId before any
  // real payment happens. Only the payment method (cod/razorpay) comes from
  // the client; everything else about a brand-new order's state is fixed
  // here. Real Razorpay success can only ever come from a future
  // signature-verified webhook/callback, never this endpoint.
  const eta = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
  let doc: OrderDoc;
  try {
    doc = await Order.create({
      customerName: input.customerName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      userId,
      idempotencyKey: idempotencyKey ?? null,
      lines,
      subtotal,
      discount,
      couponCode,
      shippingFee: shippingFee + codFee,
      tax,
      total,
      status: "confirmed",
      payment: {
        method: input.payment.method,
        status: input.payment.method === "cod" ? "pending" : "processing",
        amount: total,
        razorpayPaymentId: null,
        transactionId: null,
        paidAt: null,
        refundStatus: "none",
        refundAmount: 0,
      },
      shipment: {
        courier: null,
        awb: null,
        shipmentId: null,
        trackingUrl: null,
        estimatedDelivery: eta,
        attempts: 0,
        ndrReason: null,
        rto: false,
        events: [{ status: "confirmed", label: "Order Confirmed", at: new Date() }],
      },
      returnRequest: null,
    });
  } catch (err) {
    // No multi-document transaction here (would need a replica set) — if the
    // order write fails after we already claimed a coupon usage slot above,
    // give the slot back so a failed checkout never silently eats a real
    // customer's usage. A concurrent retry with the same idempotency key
    // hitting the unique index also lands here — refetch and return the
    // order that retry actually created instead of erroring.
    if (couponCode) await Coupon.updateOne({ code: couponCode }, { $inc: { timesUsed: -1 } });
    if (idempotencyKey) {
      const existing = await Order.findOne({ userId, idempotencyKey });
      if (existing) return toPublicOrder(existing);
    }
    throw err;
  }

  // Dispatches both rich customer receipt and store admin alert
  notifyOrderPlaced(doc).catch((err: unknown) =>
    console.error("[email] Failed to dispatch order placement notifications:", err),
  );

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

// The fulfilment pipeline admin PATCH is allowed to move an order along —
// anything not listed as a legal "next" status from the order's current one
// is rejected (e.g. delivered → packed, or skipping straight from confirmed
// to shipped). Terminal statuses (delivered/cancelled/rto/lost) map to an
// empty array, so nothing can leave them via this endpoint — cancellation
// and returns are separate, purpose-built endpoints/flows, not generic
// status edits.
// Order status transitions allowed for manual self-shipping and administrative fulfillment.
const ORDER_STATUS_TRANSITIONS: Record<string, string[]> = {
  confirmed: ["processing", "cancelled"],
  processing: ["packed", "ready_for_pickup", "cancelled"],
  packed: ["ready_for_pickup", "shipped", "cancelled"],
  ready_for_pickup: ["shipped", "cancelled"],
  shipped: ["in_transit", "out_for_delivery", "delivered", "ndr", "rto", "lost"],
  in_transit: ["out_for_delivery", "delivered", "ndr", "rto", "lost"],
  out_for_delivery: ["delivered", "delivery_failed", "ndr", "rto"],
  delivery_failed: ["out_for_delivery", "rto"],
  ndr: ["out_for_delivery", "rto"],
  delivered: [],
  cancelled: [],
  rto: [],
  lost: [],
};

// What a return can legally move to next — mirrors the pipeline implied by
// the frontend's returnRequest.status union (requested → approved/rejected →
// pickup → returned → refund initiated → completed).
const RETURN_TRANSITIONS: Record<string, string[]> = {
  requested: ["approved", "rejected"],
  approved: ["pickup_scheduled", "rejected"],
  pickup_scheduled: ["returned"],
  returned: ["refund_initiated"],
  refund_initiated: ["refund_completed"],
  rejected: [],
  refund_completed: [],
};

export async function updateOrder(
  id: string,
  patch: UpdateOrderInput,
  actor: AuditActor,
): Promise<PublicOrder> {
  const doc = await Order.findById(id);
  if (!doc) throw new NotFoundError("Order not found.");

  // Optimistic concurrency — only enforced when the caller sends the
  // version it last read (older/other clients that never send it keep
  // working unchanged). Catches "two admins open the same order, the
  // second save silently clobbers the first's change" — the read-modify-
  // write gap here is normally seconds to minutes, far wider than Mongo's
  // own within-request race window.
  if (patch.version !== undefined && patch.version !== doc.__v) {
    throw new ConflictError("This order was changed by someone else. Please reload and try again.");
  }

  const beforeStatus = doc.status;
  const beforeRefundStatus = doc.payment.refundStatus;
  const beforeRefundAmount = doc.payment.refundAmount;

  if (patch.status && patch.status !== doc.status) {
    const allowed = ORDER_STATUS_TRANSITIONS[doc.status] ?? [];
    if (!allowed.includes(patch.status)) {
      throw new ConflictError(`This order can't move from "${doc.status}" to "${patch.status}".`);
    }
  }

  if (patch.returnRequest) {
    if (!doc.returnRequest) throw new ConflictError("No return has been requested for this order.");
    const from = doc.returnRequest.status;
    const to = patch.returnRequest.status;
    if (to !== from && !(RETURN_TRANSITIONS[from] ?? []).includes(to)) {
      throw new ConflictError(`A return can't move from "${from}" to "${to}".`);
    }
    // The only place payment.refundStatus/refundAmount ever change for a
    // return — without this, an admin marking a return "refund_completed"
    // left payment.refundStatus stuck at "none" forever.
    if (to === "refund_completed") {
      doc.payment.refundStatus = "completed";
      doc.payment.refundAmount = patch.returnRequest.refundAmount ?? doc.returnRequest.refundAmount;
    } else if (to === "refund_initiated" && doc.payment.refundStatus === "none") {
      doc.payment.refundStatus = "initiated";
    }
  }

  const { version: _expectedVersion, ...fields } = patch;
  void _expectedVersion;
  doc.set(fields);

  if (patch.status && patch.status !== beforeStatus) {
    const existingEvents = doc.shipment?.events ?? [];
    const hasRecent = existingEvents.some(
      (e) => e.status === patch.status && Math.abs(new Date(e.at).getTime() - Date.now()) < 30000,
    );
    if (!hasRecent) {
      let eventLabel = `Status updated to ${patch.status}`;
      if (patch.status === "confirmed") eventLabel = "Order confirmed & received at Kolkata atelier";
      if (patch.status === "processing") eventLabel = "In tailoring & handcrafted preparation at Kolkata atelier";
      if (patch.status === "packed") eventLabel = "Garments packed & quality checked at Kolkata atelier";
      if (patch.status === "ready_for_pickup") eventLabel = "Ready for self-shipping dispatch";
      if (patch.status === "shipped")
        eventLabel = `Dispatched via ${doc.shipment?.courier || "Express Courier"}${doc.shipment?.awb ? ` · Tracking #: ${doc.shipment.awb}` : ""}`;
      if (patch.status === "in_transit") eventLabel = "Shipment in transit to destination";
      if (patch.status === "out_for_delivery") eventLabel = "Out for delivery to recipient";
      if (patch.status === "delivered") eventLabel = "Order successfully delivered to customer";
      if (patch.status === "cancelled") eventLabel = "Order cancelled";

      doc.shipment.events.push({
        status: patch.status,
        label: eventLabel,
        location: "Kolkata Atelier",
        at: new Date(),
        note: doc.shipment?.awb ? `Tracking / AWB: ${doc.shipment.awb}` : "Self-shipping dispatch by Bansal NX",
      });
    }
  }

  await doc.save();

  if (patch.status && patch.status !== beforeStatus) {
    await recordAudit({
      actor,
      action: "order.status_changed",
      entity: "order",
      entityId: id,
      before: { status: beforeStatus },
      after: { status: doc.status },
    });
    notifyOrderStatusUpdated(doc, beforeStatus, doc.status, actor).catch((err: unknown) =>
      console.error("[email] Failed to dispatch order status update notifications:", err),
    );
  }
  if (doc.payment.refundStatus !== beforeRefundStatus) {
    await recordAudit({
      actor,
      action: "order.refund_status_changed",
      entity: "order",
      entityId: id,
      before: { refundStatus: beforeRefundStatus, refundAmount: beforeRefundAmount },
      after: { refundStatus: doc.payment.refundStatus, refundAmount: doc.payment.refundAmount },
    });
  }

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
  if (doc.status !== "delivered") {
    throw new ConflictError("Returns can only be requested for delivered orders.");
  }
  if (doc.returnRequest && doc.returnRequest.status !== "rejected") {
    throw new ConflictError("A return has already been requested for this order.");
  }

  doc.returnRequest = {
    status: "requested",
    reason: input.reason,
    requestedAt: new Date(),
    refundAmount: doc.total,
  };
  await doc.save();
  return toPublicOrder(doc);
}

// Matches the frontend's (previously local-only) cancelOrder logic exactly:
// only cancellable before it's left the warehouse, refund vs. plain
// cancellation depends on whether it was already paid.
const CANCELLABLE_STATUSES = new Set(["confirmed", "processing", "packed", "ready_for_pickup"]);

export async function cancelOrder(
  id: string,
  userId: string,
  actor: AuditActor,
  reason?: string,
): Promise<PublicOrder> {
  const doc = await Order.findById(id);
  if (!doc) throw new NotFoundError("Order not found.");
  if (doc.userId !== userId) throw new ForbiddenError("This isn't your order.");
  if (!CANCELLABLE_STATUSES.has(doc.status)) {
    throw new ConflictError("This order can no longer be cancelled.");
  }

  const beforeStatus = doc.status;
  const wasPaid = doc.payment.status === "paid";

  doc.status = "cancelled";
  doc.payment.status = wasPaid ? "refunded" : "cancelled";
  const cancelLabel = reason ? `Cancelled: ${reason}` : "Cancelled by customer";
  doc.shipment.events.push({ status: "cancelled", label: cancelLabel, at: new Date() });
  await doc.save();

  await recordAudit({
    actor,
    action: "order.cancelled",
    entity: "order",
    entityId: id,
    before: { status: beforeStatus, paymentStatus: wasPaid ? "paid" : doc.payment.status },
    after: { status: doc.status, paymentStatus: doc.payment.status },
  });

  notifyOrderCancelled(doc, cancelLabel, actor).catch((err: unknown) =>
    console.error("[email] Failed to dispatch order cancellation notifications:", err),
  );

  return toPublicOrder(doc);
}

export async function trackOrder(id: string, email: string): Promise<PublicOrder> {
  const doc = await Order.findById(id).catch(() => null);
  if (!doc || doc.email !== email.trim().toLowerCase()) {
    throw new NotFoundError("We couldn't find an order matching those details.");
  }
  return toPublicOrder(doc);
}
