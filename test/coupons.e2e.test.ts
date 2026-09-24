import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;
let server: Server;
let base: string;
let disconnectDb: () => Promise<void>;
let customerToken: string;
let adminToken: string;
let productId: string;

function readJson(res: Response): Promise<any> {
  return res.json();
}

function buildCouponInput(overrides: Record<string, unknown> = {}) {
  return {
    code: "welcome15",
    type: "percent",
    value: 15,
    minOrder: 2000,
    maxDiscount: null,
    startsAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    usageLimit: null,
    perUserLimit: 1,
    newCustomerOnly: false,
    restrictedCollections: [],
    isPublic: true,
    active: true,
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
    email: "coupons-customer@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Cat",
    lastName: "Customer",
    phone: "9876543210",
  });
  await User.create({
    email: "coupons-admin@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Ops",
    lastName: "Admin",
    phone: "9876543210",
    role: "admin",
  });

  const { Product } = await import("../src/modules/catalog/models/index.js");
  const product = await Product.create({
    name: "Test Lehenga",
    slug: "test-lehenga-coupons",
    price: 3000,
    mrp: 4000,
    images: ["https://example.com/a.jpg"],
    category: "lehenga",
    collections: [],
    shortDescription: "test",
    description: "test",
    variants: [{ size: "M", colour: "Red", availability: "available" }],
  });
  productId = product._id.toString();

  async function login(email: string): Promise<string> {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-1" }),
    });
    const body = await readJson(res);
    return body.accessToken;
  }
  customerToken = await login("coupons-customer@example.com");
  adminToken = await login("coupons-admin@example.com");
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
});

describe("coupons (against a real MongoDB instance)", () => {
  it("rejects the full coupon listing from an unauthenticated caller", async () => {
    const res = await fetch(`${base}/api/coupons`);
    assert.equal(res.status, 401);
  });

  it("rejects the full coupon listing from a non-admin customer", async () => {
    const res = await fetch(`${base}/api/coupons`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("lets an admin list all coupons", async () => {
    const res = await fetch(`${base}/api/coupons`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.coupons));
  });

  it("the public listing works without auth and starts empty", async () => {
    const res = await fetch(`${base}/api/coupons/public`);
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.coupons));
  });

  it("rejects coupon creation from an unauthenticated caller", async () => {
    const res = await fetch(`${base}/api/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCouponInput()),
    });
    assert.equal(res.status, 401);
  });

  it("rejects coupon creation from a non-admin customer", async () => {
    const res = await fetch(`${base}/api/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(buildCouponInput()),
    });
    assert.equal(res.status, 403);
  });

  it("rejects an invalid coupon body", async () => {
    const res = await fetch(`${base}/api/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(buildCouponInput({ value: -5 })),
    });
    assert.equal(res.status, 400);
  });

  it("lets an admin create a coupon, uppercasing the code", async () => {
    const res = await fetch(`${base}/api/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(buildCouponInput()),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.equal(body.coupon.code, "WELCOME15");
    assert.equal(body.coupon.timesUsed, 0);
    assert.equal(body.coupon.isPublic, true);
  });

  it("rejects a duplicate coupon code", async () => {
    const res = await fetch(`${base}/api/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(buildCouponInput({ code: "WELCOME15" })),
    });
    assert.equal(res.status, 409);
  });

  it("the new public coupon shows up in the public list", async () => {
    const res = await fetch(`${base}/api/coupons/public`);
    const body = await readJson(res);
    assert.ok(body.coupons.some((c: { code: string }) => c.code === "WELCOME15"));
  });

  it("a coupon created with isPublic: false is hidden from the public list", async () => {
    await fetch(`${base}/api/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(buildCouponInput({ code: "HIDDEN10", value: 10, isPublic: false })),
    });
    const res = await fetch(`${base}/api/coupons/public`);
    const body = await readJson(res);
    assert.ok(!body.coupons.some((c: { code: string }) => c.code === "HIDDEN10"));
  });

  it("rejects coupon validation from an unauthenticated caller", async () => {
    const res = await fetch(`${base}/api/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "WELCOME15", lines: [{ productId, quantity: 1 }] }),
    });
    assert.equal(res.status, 401);
  });

  it("validates an eligible coupon and computes the discount server-side, ignoring the hidden code being unlisted", async () => {
    const res = await fetch(`${base}/api/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ code: "HIDDEN10", lines: [{ productId, quantity: 1 }] }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.couponCode, "HIDDEN10");
    assert.equal(body.subtotal, 3000);
    assert.equal(body.discount, 300);
  });

  it("rejects validation for a cart below the coupon's minimum order", async () => {
    await fetch(`${base}/api/coupons`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(buildCouponInput({ code: "BIGSPEND", minOrder: 100000 })),
    });
    const res = await fetch(`${base}/api/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ code: "BIGSPEND", lines: [{ productId, quantity: 1 }] }),
    });
    assert.equal(res.status, 409);
  });

  it("rejects validation for an unknown code", async () => {
    const res = await fetch(`${base}/api/coupons/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ code: "NOPE", lines: [{ productId, quantity: 1 }] }),
    });
    assert.equal(res.status, 409);
  });

  it("rejects deletion from a non-admin customer", async () => {
    const listRes = await fetch(`${base}/api/coupons`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { coupons } = await readJson(listRes);
    const id = coupons[0].id;

    const res = await fetch(`${base}/api/coupons/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(res.status, 403);
  });

  it("lets an admin delete a coupon", async () => {
    const listRes = await fetch(`${base}/api/coupons`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { coupons } = await readJson(listRes);
    const id = coupons[0].id;

    const res = await fetch(`${base}/api/coupons/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 204);

    const afterRes = await fetch(`${base}/api/coupons`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const { coupons: after } = await readJson(afterRes);
    assert.ok(!after.some((c: { id: string }) => c.id === id));
  });

  it("404s deleting a coupon that doesn't exist", async () => {
    const res = await fetch(`${base}/api/coupons/000000000000000000000000`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(res.status, 404);
  });
});
