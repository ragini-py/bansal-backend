import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;
let server: Server;
let base: string;
let disconnectDb: () => Promise<void>;
let customerToken: string;
let otherCustomerToken: string;
let adminToken: string;
let createdOrderId: string;
let seededProductId: string;

function readJson(res: Response): Promise<any> {
  return res.json();
}

// Walks an order through a sequence of legal status transitions (the admin
// PATCH endpoint now enforces a real state machine — see orders.service.ts's
// ORDER_STATUS_TRANSITIONS — so tests that need an order in a later-pipeline
// status can't just PATCH straight to it anymore).
async function advanceOrderStatus(id: string, statuses: string[], token: string): Promise<Response> {
  let res: Response;
  do {
    const next = statuses.shift()!;
    res = await fetch(`${base}/api/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: next }),
    });
  } while (statuses.length > 0 && res.ok);
  return res;
}

// price/mrp are ignored by the server (re-derived from the live Product —
// see orders.service.ts's createOrder) and are here only to keep the
// request shape valid; assertions below check against the seeded product's
// real price (10000/12000), not these values. Likewise `status`, everything
// in `payment` besides `method`, `shipment`, and `returnRequest` are all
// ignored too — a brand-new order is always "confirmed" with a fresh
// server-built payment/shipment record, never trusted from the client (see
// orders.service.ts's createOrder).
function buildOrderInput(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Priya Sharma",
    email: "orders-customer@example.com",
    phone: "9876543210",
    lines: [
      {
        productId: seededProductId,
        name: "Test Saree",
        image: "/products/test.jpg",
        slug: "test-saree",
        size: "Free Size",
        colour: "Gold",
        quantity: 1,
        price: 10000,
        mrp: 12000,
      },
    ],
    subtotal: 10000,
    discount: 0,
    couponCode: null,
    shippingFee: 0,
    tax: 0,
    total: 10000,
    status: "confirmed",
    payment: {
      method: "cod",
      status: "pending",
      amount: 10000,
      razorpayPaymentId: null,
      transactionId: null,
      paidAt: null,
      refundStatus: "none",
      refundAmount: 0,
    },
    address: {
      id: "adr-1",
      label: "Home",
      fullName: "Priya Sharma",
      phone: "9876543210",
      line1: "1 Park St",
      locality: "Ballygunge",
      city: "Kolkata",
      state: "WB",
      pincode: "700019",
      country: "India",
      isDefault: true,
    },
    shipment: {
      courier: null,
      awb: null,
      shipmentId: null,
      trackingUrl: null,
      estimatedDelivery: null,
      attempts: 0,
      ndrReason: null,
      rto: false,
      events: [],
    },
    returnRequest: null,
    ...overrides,
  };
}

before(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.NODE_ENV = "test";
  process.env.MONGODB_URI = mongod.getUri();
  process.env.CORS_ORIGIN = "http://localhost:5173";
  process.env.JWT_ACCESS_SECRET = "test-secret-test-secret-test-secret-test-secret";
  process.env.APP_URL = "http://localhost:4000";

  const { createApp } = await import("../src/app.js");
  const { connectDb, disconnectDb: disconnect } = await import("../src/db/connect.js");
  disconnectDb = disconnect;

  await connectDb();
  server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://localhost:${port}`;

  const { User } = await import("../src/modules/auth/models/index.js");
  const { hashPassword } = await import("../src/utils/password.js");
  await User.create({
    email: "orders-customer@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Priya",
    lastName: "Sharma",
    phone: "9876543210",
    isEmailVerified: true,
  });
  await User.create({
    email: "orders-other@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Other",
    lastName: "Customer",
    phone: "9876543210",
    isEmailVerified: true,
  });
  await User.create({
    email: "orders-admin@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Ops",
    lastName: "Admin",
    phone: "9876543210",
    role: "admin",
    isEmailVerified: true,
  });

  async function login(email: string): Promise<string> {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-1" }),
    });
    const body = await readJson(res);
    return body.accessToken;
  }
  customerToken = await login("orders-customer@example.com");
  otherCustomerToken = await login("orders-other@example.com");
  adminToken = await login("orders-admin@example.com");

  const { Product } = await import("../src/modules/catalog/models/index.js");
  const product = await Product.create({
    slug: "test-saree",
    name: "Test Saree",
    price: 10000,
    mrp: 12000,
    images: ["/products/test.jpg"],
    category: "Sarees",
    collections: [],
    shortDescription: "A test saree.",
    description: "A test saree used for e2e coverage.",
    sizes: ["Free Size"],
    colours: ["Gold"],
    variants: [{ size: "Free Size", colour: "Gold", availability: "available" }],
    published: true,
  });
  seededProductId = product._id.toString();
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
});

describe("orders (against a real MongoDB instance)", () => {
  it("rejects order creation from an unauthenticated caller", async () => {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildOrderInput()),
    });
    assert.equal(res.status, 401);
  });

  it("rejects an invalid order body", async () => {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(buildOrderInput({ lines: [] })),
    });
    assert.equal(res.status, 400);
  });

  it("re-prices lines from the live product, ignoring a tampered client price", async () => {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(
        buildOrderInput({
          lines: [
            {
              productId: seededProductId,
              name: "Test Saree",
              image: "/products/test.jpg",
              slug: "test-saree",
              size: "Free Size",
              colour: "Gold",
              quantity: 2,
              price: 1, // tampered — real price is 10000
              mrp: 1,
            },
          ],
          subtotal: 2, // tampered — should become 20000 (2 x real price)
          total: 2,
        }),
      ),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.equal(body.order.lines[0].price, 10000);
    assert.equal(body.order.subtotal, 20000);
    // 20000 is below the default free-shipping threshold (25000), and the
    // default payment method here is cod — total also re-derives shipping
    // (350) + cod fee (99) from live Settings, see orders.service.ts.
    assert.equal(body.order.total, 20449);
  });

  it("404s creating an order for a product that doesn't exist", async () => {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(
        buildOrderInput({
          lines: [
            {
              productId: "000000000000000000000099",
              name: "Ghost Product",
              image: "",
              slug: "ghost",
              size: "M",
              colour: "Gold",
              quantity: 1,
              price: 100,
              mrp: 100,
            },
          ],
        }),
      ),
    });
    assert.equal(res.status, 404);
  });

  it("rejects an order for an unpublished product", async () => {
    const { Product } = await import("../src/modules/catalog/models/index.js");
    const draft = await Product.create({
      slug: "draft-saree",
      name: "Draft Saree",
      price: 8000,
      mrp: 9000,
      images: ["/products/draft.jpg"],
      category: "Sarees",
      collections: [],
      shortDescription: "Draft product.",
      description: "Draft product used for availability tests.",
      sizes: ["Free Size"],
      colours: ["Rose Gold"],
      variants: [{ size: "Free Size", colour: "Rose Gold", availability: "available" }],
      published: false,
    });

    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(
        buildOrderInput({
          lines: [
            {
              productId: draft._id.toString(),
              name: "Draft Saree",
              image: "/products/draft.jpg",
              slug: draft.slug,
              size: "Free Size",
              colour: "Rose Gold",
              quantity: 1,
              price: 8000,
              mrp: 9000,
            },
          ],
        }),
      ),
    });
    assert.equal(res.status, 409);
  });

  it("rejects an order for a variant marked unavailable", async () => {
    const { Product } = await import("../src/modules/catalog/models/index.js");
    const unavailable = await Product.create({
      slug: "sold-out-saree",
      name: "Sold Out Saree",
      price: 7000,
      mrp: 8000,
      images: ["/products/sold-out.jpg"],
      category: "Sarees",
      collections: [],
      shortDescription: "Sold out variant.",
      description: "Sold out variant used for coverage.",
      sizes: ["Free Size"],
      colours: ["Ivory"],
      variants: [{ size: "Free Size", colour: "Ivory", availability: "unavailable" }],
      published: true,
    });

    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(
        buildOrderInput({
          lines: [
            {
              productId: unavailable._id.toString(),
              name: "Sold Out Saree",
              image: "/products/sold-out.jpg",
              slug: unavailable.slug,
              size: "Free Size",
              colour: "Ivory",
              quantity: 1,
              price: 7000,
              mrp: 8000,
            },
          ],
        }),
      ),
    });
    assert.equal(res.status, 409);
  });

  it("successfully creates an order when server-recalculated fields are omitted", async () => {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        customerName: "Priya Sharma",
        email: "orders-customer@example.com",
        phone: "9876543210",
        lines: [
          {
            productId: seededProductId,
            name: "Test Saree",
            image: "/products/test.jpg",
            slug: "test-saree",
            size: "Free Size",
            colour: "Gold",
            quantity: 1,
            price: 10000,
            mrp: 12000,
          },
        ],
        payment: {
          method: "cod",
        },
        address: {
          id: "adr-minimal",
          label: "Home",
          fullName: "Priya Sharma",
          phone: "9876543210",
          line1: "1 Park St",
          locality: "Ballygunge",
          city: "Kolkata",
          state: "WB",
          pincode: "700019",
          country: "India",
          isDefault: true,
        },
      }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.equal(body.order.status, "confirmed");
    assert.equal(body.order.subtotal, 10000);
    assert.equal(body.order.payment.method, "cod");
    assert.ok(body.order.shipment);
  });

  it("never trusts a client-asserted payment/order status, forcing a fresh confirmed/processing order regardless of what's sent", async () => {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(
        buildOrderInput({
          status: "delivered",
          payment: {
            method: "razorpay",
            status: "paid",
            amount: 10000,
            razorpayPaymentId: "pay_fake_client_asserted",
            transactionId: "fake",
            paidAt: new Date().toISOString(),
            refundStatus: "completed",
            refundAmount: 10000,
          },
          shipment: {
            courier: "FakeCourier",
            awb: "FAKE123",
            shipmentId: "ship_fake",
            trackingUrl: "https://example.com/fake",
            estimatedDelivery: new Date().toISOString(),
            attempts: 5,
            ndrReason: null,
            rto: false,
            events: [{ status: "delivered", label: "Delivered", at: new Date().toISOString() }],
          },
          returnRequest: {
            status: "refund_completed",
            reason: "fake",
            requestedAt: new Date().toISOString(),
            refundAmount: 10000,
          },
        }),
      ),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.equal(body.order.status, "confirmed");
    assert.equal(body.order.payment.status, "processing");
    assert.equal(body.order.payment.razorpayPaymentId, null);
    assert.equal(body.order.payment.paidAt, null);
    assert.equal(body.order.payment.refundStatus, "none");
    assert.equal(body.order.shipment.courier, null);
    assert.equal(body.order.shipment.events.length, 1);
    assert.equal(body.order.shipment.events[0].status, "confirmed");
    assert.equal(body.order.returnRequest, null);
  });

  it("creates an order for the authenticated caller, ignoring any client-sent userId", async () => {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(buildOrderInput({ userId: "someone-elses-id" })),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.equal(body.order.customerName, "Priya Sharma");
    assert.notEqual(body.order.userId, "someone-elses-id");
    createdOrderId = body.order.id;
  });

  it("lists only the caller's own orders under /orders/mine", async () => {
    const res = await fetch(`${base}/api/orders/mine`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.ok(body.orders.some((o: { id: string }) => o.id === createdOrderId));

    const otherRes = await fetch(`${base}/api/orders/mine`, {
      headers: { Authorization: `Bearer ${otherCustomerToken}` },
    });
    const otherBody = await readJson(otherRes);
    assert.equal(otherBody.orders.length, 0);
  });

  it("rejects a non-admin listing all orders", async () => {
    const res = await fetch(`${base}/api/orders`, { headers: { Authorization: `Bearer ${customerToken}` } });
    assert.equal(res.status, 403);
  });

  it("lets an admin list all orders", async () => {
    const res = await fetch(`${base}/api/orders`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.ok(body.orders.some((o: { id: string }) => o.id === createdOrderId));
  });

  it("rejects a non-admin patching an order", async () => {
    const res = await fetch(`${base}/api/orders/${createdOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ status: "processing" }),
    });
    assert.equal(res.status, 403);
  });

  it("lets an admin patch an order's status to the next legal step", async () => {
    const res = await fetch(`${base}/api/orders/${createdOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "processing" }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.order.status, "processing");
  });

  it("rejects an impossible status jump, e.g. skipping straight to shipped", async () => {
    const res = await fetch(`${base}/api/orders/${createdOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "shipped" }),
    });
    assert.equal(res.status, 409);
  });

  it("prevents a customer from requesting a return on someone else's order", async () => {
    const res = await fetch(`${base}/api/orders/${createdOrderId}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${otherCustomerToken}` },
      body: JSON.stringify({ reason: "Not what I expected" }),
    });
    assert.equal(res.status, 403);
  });

  it("rejects a return request on an order that hasn't been delivered yet", async () => {
    const res = await fetch(`${base}/api/orders/${createdOrderId}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ reason: "Too early" }),
    });
    assert.equal(res.status, 409);
  });

  it("lets the owning customer request a return once the order is delivered", async () => {
    // createdOrderId is currently "processing" (see the transition tests
    // above) — walk it through the rest of the legal pipeline to reach
    // "delivered", since the state machine no longer allows jumping there.
    const finalRes = await advanceOrderStatus(
      createdOrderId,
      ["packed", "ready_for_pickup", "shipped", "in_transit", "out_for_delivery", "delivered"],
      adminToken,
    );
    assert.equal(finalRes.status, 200);

    const res = await fetch(`${base}/api/orders/${createdOrderId}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ reason: "Not what I expected" }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.order.returnRequest.status, "requested");
    assert.equal(body.order.returnRequest.reason, "Not what I expected");
  });

  it("rejects moving a delivered order backward, e.g. delivered → packed", async () => {
    const res = await fetch(`${base}/api/orders/${createdOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "packed" }),
    });
    assert.equal(res.status, 409);
  });

  it("rejects a second return request while one is already in progress", async () => {
    const res = await fetch(`${base}/api/orders/${createdOrderId}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ reason: "Trying again" }),
    });
    assert.equal(res.status, 409);
  });

  it("prevents a customer from cancelling someone else's order", async () => {
    const createRes = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(buildOrderInput()),
    });
    const { order } = await readJson(createRes);

    const res = await fetch(`${base}/api/orders/${order.id}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${otherCustomerToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("lets the owning customer cancel an order that hasn't shipped, and refunds it if it was paid", async () => {
    const createRes = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(
        buildOrderInput({
          payment: {
            method: "razorpay",
            status: "processing",
            amount: 10000,
            razorpayPaymentId: null,
            transactionId: null,
            paidAt: null,
            refundStatus: "none",
            refundAmount: 0,
          },
        }),
      ),
    });
    const { order } = await readJson(createRes);

    // A brand-new razorpay order is never created as "paid" (see
    // orders.service.ts — that can only ever come from a real payment
    // verification webhook, not this endpoint). Simulate that webhook
    // having already run, to exercise cancelOrder's refund branch.
    const { Order } = await import("../src/modules/orders/models/order.model.js");
    await Order.updateOne({ _id: order.id }, { $set: { "payment.status": "paid" } });

    const res = await fetch(`${base}/api/orders/${order.id}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.order.status, "cancelled");
    assert.equal(body.order.payment.status, "refunded");
    assert.ok(body.order.shipment.events.some((e: { status: string }) => e.status === "cancelled"));
  });

  it("won't cancel an order that's already been delivered", async () => {
    const res = await fetch(`${base}/api/orders/${createdOrderId}/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 409);
  });

  it("404s cancelling an order that doesn't exist", async () => {
    const res = await fetch(`${base}/api/orders/000000000000000000000000/cancel`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 404);
  });

  it("tracks an order publicly by id + email, without auth", async () => {
    const res = await fetch(`${base}/api/orders/track?id=${createdOrderId}&email=orders-customer@example.com`);
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.order.id, createdOrderId);
  });

  it("404s tracking with the wrong email", async () => {
    const res = await fetch(`${base}/api/orders/track?id=${createdOrderId}&email=wrong@example.com`);
    assert.equal(res.status, 404);
  });

  it("400s tracking without an email — id alone must never be enough", async () => {
    const res = await fetch(`${base}/api/orders/track?id=${createdOrderId}`);
    assert.equal(res.status, 400);
  });

  it("404s tracking an id that doesn't exist", async () => {
    const res = await fetch(`${base}/api/orders/track?id=000000000000000000000000&email=orders-customer@example.com`);
    assert.equal(res.status, 404);
  });
});

describe("coupon enforcement at order creation (against a real MongoDB instance)", () => {
  let freshCustomerToken: string;
  let freshCustomerEmail: string;

  async function makeCoupon(overrides: Record<string, unknown> = {}) {
    const { Coupon } = await import("../src/modules/coupons/models/coupon.model.js");
    return Coupon.create({
      code: `TEST${Date.now()}${Math.floor(Math.random() * 1000)}`,
      type: "percent",
      value: 10,
      minOrder: 0,
      startsAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() + 60_000),
      active: true,
      ...overrides,
    });
  }

  before(async () => {
    freshCustomerEmail = `coupon-cust-${Date.now()}@example.com`;
    const { User } = await import("../src/modules/auth/models/index.js");
    const { hashPassword } = await import("../src/utils/password.js");
    await User.create({
      firstName: "Coupon",
      lastName: "Cust",
      email: freshCustomerEmail,
      phone: "9876543210",
      passwordHash: await hashPassword("correct-horse-1"),
      isEmailVerified: true,
      status: "active",
    });
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: freshCustomerEmail, password: "correct-horse-1" }),
    });
    freshCustomerToken = (await readJson(loginRes)).accessToken;
  });

  it("applies a valid coupon's discount and increments timesUsed", async () => {
    const coupon = await makeCoupon({ value: 10 });
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshCustomerToken}` },
      body: JSON.stringify(
        buildOrderInput({ email: freshCustomerEmail, couponCode: coupon.code, discount: 999 }),
      ),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.equal(body.order.discount, 1000); // 10% of 10000
    // 9000 (after discount) is below the free-shipping threshold, and the
    // default payment method is cod — total includes shipping (350) + cod
    // fee (99) from live Settings, same as the price-tampering test above.
    assert.equal(body.order.total, 9449);

    const { Coupon } = await import("../src/modules/coupons/models/coupon.model.js");
    const updated = await Coupon.findById(coupon._id);
    assert.equal(updated?.timesUsed, 1);
  });

  it("rejects an order with an unknown coupon code", async () => {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshCustomerToken}` },
      body: JSON.stringify(buildOrderInput({ email: freshCustomerEmail, couponCode: "NOPE404" })),
    });
    assert.equal(res.status, 409);
  });

  it("rejects an order with an expired coupon", async () => {
    const coupon = await makeCoupon({
      startsAt: new Date(Date.now() - 120_000),
      expiresAt: new Date(Date.now() - 60_000),
    });
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshCustomerToken}` },
      body: JSON.stringify(buildOrderInput({ email: freshCustomerEmail, couponCode: coupon.code })),
    });
    assert.equal(res.status, 409);
  });

  it("rejects an order below the coupon's minimum order value", async () => {
    const coupon = await makeCoupon({ minOrder: 50000 });
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshCustomerToken}` },
      body: JSON.stringify(buildOrderInput({ email: freshCustomerEmail, couponCode: coupon.code })),
    });
    assert.equal(res.status, 409);
  });

  it("enforces perUserLimit — a second use by the same customer is rejected", async () => {
    const coupon = await makeCoupon({ perUserLimit: 1 });
    const first = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshCustomerToken}` },
      body: JSON.stringify(buildOrderInput({ email: freshCustomerEmail, couponCode: coupon.code })),
    });
    assert.equal(first.status, 201);

    const second = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshCustomerToken}` },
      body: JSON.stringify(buildOrderInput({ email: freshCustomerEmail, couponCode: coupon.code })),
    });
    assert.equal(second.status, 409);
  });

  it("enforces newCustomerOnly — rejected once the customer already has an order", async () => {
    // freshCustomerToken already has orders from the tests above.
    const coupon = await makeCoupon({ newCustomerOnly: true });
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshCustomerToken}` },
      body: JSON.stringify(buildOrderInput({ email: freshCustomerEmail, couponCode: coupon.code })),
    });
    assert.equal(res.status, 409);
  });

  it("enforces restrictedCollections — rejected when the cart has no matching product", async () => {
    const coupon = await makeCoupon({ restrictedCollections: ["heritage-classics"] });
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshCustomerToken}` },
      body: JSON.stringify(buildOrderInput({ email: freshCustomerEmail, couponCode: coupon.code })),
    });
    assert.equal(res.status, 409);
  });

  it("enforces usageLimit atomically — a claim that would exceed it is rejected, and timesUsed never overshoots", async () => {
    const coupon = await makeCoupon({ usageLimit: 1 });

    const first = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshCustomerToken}` },
      body: JSON.stringify(buildOrderInput({ email: freshCustomerEmail, couponCode: coupon.code })),
    });
    assert.equal(first.status, 201);

    const second = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshCustomerToken}` },
      body: JSON.stringify(buildOrderInput({ email: freshCustomerEmail, couponCode: coupon.code })),
    });
    assert.equal(second.status, 409);

    const { Coupon } = await import("../src/modules/coupons/models/coupon.model.js");
    const updated = await Coupon.findById(coupon._id);
    assert.equal(updated?.timesUsed, 1);
  });

  it("gives the coupon usage slot back if order creation fails after the claim", async () => {
    const coupon = await makeCoupon({ usageLimit: 1 });

    // Trigger a post-claim failure deliberately: a line referencing a
    // product id that doesn't exist 404s inside createOrder, after the
    // coupon claim has already run.
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${freshCustomerToken}` },
      body: JSON.stringify(
        buildOrderInput({
          email: freshCustomerEmail,
          couponCode: coupon.code,
          lines: [
            {
              productId: "000000000000000000000099",
              name: "Ghost Product",
              image: "",
              slug: "ghost",
              size: "M",
              colour: "Gold",
              quantity: 1,
              price: 100,
              mrp: 100,
            },
          ],
        }),
      ),
    });
    assert.equal(res.status, 404);

    const { Coupon } = await import("../src/modules/coupons/models/coupon.model.js");
    const updated = await Coupon.findById(coupon._id);
    assert.equal(updated?.timesUsed, 0);
  });
});

describe("idempotent order creation (against a real MongoDB instance)", () => {
  let idemCustomerToken: string;
  let idemCustomerEmail: string;

  before(async () => {
    idemCustomerEmail = `idem-cust-${Date.now()}@example.com`;
    const { User } = await import("../src/modules/auth/models/index.js");
    const { hashPassword } = await import("../src/utils/password.js");
    await User.create({
      firstName: "Idem",
      lastName: "Cust",
      email: idemCustomerEmail,
      phone: "9876543210",
      passwordHash: await hashPassword("correct-horse-1"),
      isEmailVerified: true,
      status: "active",
    });
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: idemCustomerEmail, password: "correct-horse-1" }),
    });
    idemCustomerToken = (await readJson(loginRes)).accessToken;
  });

  it("a retried request with the same Idempotency-Key returns the original order instead of creating a duplicate", async () => {
    const key = `checkout-${Date.now()}`;
    const body = JSON.stringify(buildOrderInput({ email: idemCustomerEmail }));

    const first = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key, Authorization: `Bearer ${idemCustomerToken}` },
      body,
    });
    const firstBody = await readJson(first);
    assert.equal(first.status, 201);

    const retry = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key, Authorization: `Bearer ${idemCustomerToken}` },
      body,
    });
    const retryBody = await readJson(retry);
    assert.equal(retry.status, 201);
    assert.equal(retryBody.order.id, firstBody.order.id);

    const { Order } = await import("../src/modules/orders/models/order.model.js");
    const count = await Order.countDocuments({ userId: firstBody.order.userId });
    assert.equal(count, 1);
  });

  it("a different Idempotency-Key creates a genuinely separate order", async () => {
    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `checkout-${Date.now()}-other`,
        Authorization: `Bearer ${idemCustomerToken}`,
      },
      body: JSON.stringify(buildOrderInput({ email: idemCustomerEmail })),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);

    const { Order } = await import("../src/modules/orders/models/order.model.js");
    const count = await Order.countDocuments({ userId: body.order.userId });
    assert.equal(count, 2);
  });
});

describe("shipping/COD pricing from live Settings (against a real MongoDB instance)", () => {
  let shippingCustomerToken: string;
  let shippingCustomerEmail: string;

  before(async () => {
    shippingCustomerEmail = `shipping-cust-${Date.now()}@example.com`;
    const { User } = await import("../src/modules/auth/models/index.js");
    const { hashPassword } = await import("../src/utils/password.js");
    await User.create({
      firstName: "Ship",
      lastName: "Cust",
      email: shippingCustomerEmail,
      phone: "9876543210",
      passwordHash: await hashPassword("correct-horse-1"),
      isEmailVerified: true,
      status: "active",
    });
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: shippingCustomerEmail, password: "correct-horse-1" }),
    });
    shippingCustomerToken = (await readJson(loginRes)).accessToken;
  });

  it("charges the configured shipping fee below the free-shipping threshold, waives it above", async () => {
    const { Settings } = await import("../src/modules/settings/models/settings.model.js");
    await Settings.findOneAndUpdate(
      {},
      { $set: { freeShippingThreshold: 25000, shippingFee: 350, codFee: 99, codEnabled: true, codMaxOrderValue: 50000 } },
      { upsert: true },
    );

    const belowRes = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${shippingCustomerToken}` },
      body: JSON.stringify(buildOrderInput({ email: shippingCustomerEmail })), // subtotal 10000, cod
    });
    const belowBody = await readJson(belowRes);
    assert.equal(belowRes.status, 201);
    assert.equal(belowBody.order.shippingFee, 350 + 99);
    assert.equal(belowBody.order.total, 10000 + 350 + 99);

    const aboveRes = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${shippingCustomerToken}` },
      body: JSON.stringify(
        buildOrderInput({
          email: shippingCustomerEmail,
          lines: [
            {
              productId: seededProductId,
              name: "Test Saree",
              image: "/products/test.jpg",
              slug: "test-saree",
              size: "Free Size",
              colour: "Gold",
              quantity: 3, // 3 x 10000 = 30000, above the 25000 threshold
              price: 10000,
              mrp: 12000,
            },
          ],
        }),
      ),
    });
    const aboveBody = await readJson(aboveRes);
    assert.equal(aboveRes.status, 201);
    assert.equal(aboveBody.order.shippingFee, 99); // free shipping, cod fee still applies
    assert.equal(aboveBody.order.total, 30000 + 99);
  });

  it("rejects COD when it's disabled in Settings", async () => {
    const { Settings } = await import("../src/modules/settings/models/settings.model.js");
    await Settings.findOneAndUpdate({}, { $set: { codEnabled: false } }, { upsert: true });

    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${shippingCustomerToken}` },
      body: JSON.stringify(buildOrderInput({ email: shippingCustomerEmail })),
    });
    assert.equal(res.status, 409);

    await Settings.findOneAndUpdate({}, { $set: { codEnabled: true } }, { upsert: true });
  });

  it("rejects COD above the configured maximum order value", async () => {
    const { Settings } = await import("../src/modules/settings/models/settings.model.js");
    await Settings.findOneAndUpdate({}, { $set: { codMaxOrderValue: 5000 } }, { upsert: true });

    const res = await fetch(`${base}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${shippingCustomerToken}` },
      body: JSON.stringify(buildOrderInput({ email: shippingCustomerEmail })), // subtotal 10000 > 5000
    });
    assert.equal(res.status, 409);
  });
});
