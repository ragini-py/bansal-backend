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

function readJson(res: Response): Promise<any> {
  return res.json();
}

function buildOrderInput(overrides: Record<string, unknown> = {}) {
  return {
    customerName: "Priya Sharma",
    email: "orders-customer@example.com",
    phone: "9876543210",
    lines: [
      {
        productId: "000000000000000000000001",
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
  });
  await User.create({
    email: "orders-other@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Other",
    lastName: "Customer",
    phone: "9876543210",
  });
  await User.create({
    email: "orders-admin@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Ops",
    lastName: "Admin",
    phone: "9876543210",
    role: "admin",
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
      body: JSON.stringify({ status: "shipped" }),
    });
    assert.equal(res.status, 403);
  });

  it("lets an admin patch an order's status", async () => {
    const res = await fetch(`${base}/api/orders/${createdOrderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "shipped" }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.order.status, "shipped");
  });

  it("prevents a customer from requesting a return on someone else's order", async () => {
    const res = await fetch(`${base}/api/orders/${createdOrderId}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${otherCustomerToken}` },
      body: JSON.stringify({ reason: "Not what I expected" }),
    });
    assert.equal(res.status, 403);
  });

  it("lets the owning customer request a return", async () => {
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
