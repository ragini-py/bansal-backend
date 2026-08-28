import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;
let server: Server;
let base: string;
let disconnectDb: () => Promise<void>;
let adminToken: string;
let customerToken: string;
let seededProductId: string;

function readJson(res: Response): Promise<any> {
  return res.json();
}

const productInput = {
  slug: "test-silk-saree",
  name: "Test Silk Saree",
  price: 10000,
  mrp: 12000,
  currency: "INR" as const,
  images: ["/products/test.jpg"],
  category: "Sarees",
  collections: [],
  tags: ["silk"],
  badge: null,
  shortDescription: "A test saree.",
  description: "A test saree used for e2e coverage.",
  details: ["Test detail"],
  care: ["Dry clean only"],
  sizes: ["Free Size"],
  colours: ["Gold"],
  variants: [{ size: "Free Size", colour: "Gold", availability: "available" as const }],
  featured: false,
  bestseller: false,
  newArrival: false,
  published: false,
};

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

  const { Product } = await import("../src/modules/catalog/models/index.js");
  const doc = await Product.create(productInput);
  seededProductId = doc._id.toString();

  const { User } = await import("../src/modules/auth/models/index.js");
  const { hashPassword } = await import("../src/utils/password.js");
  await User.create({
    email: "catalog-customer@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Cat",
    lastName: "Customer",
    phone: "9876543210",
  });
  await User.create({
    email: "catalog-admin@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Cat",
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
  customerToken = await login("catalog-customer@example.com");
  adminToken = await login("catalog-admin@example.com");
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
});

describe("catalog (against a real MongoDB instance)", () => {
  it("lists products, including unpublished ones (matches existing mock behavior)", async () => {
    const res = await fetch(`${base}/api/products`);
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.products));
    assert.ok(body.products.some((p: { slug: string }) => p.slug === "test-silk-saree"));
  });

  it("gets a single product by slug", async () => {
    const res = await fetch(`${base}/api/products/test-silk-saree`);
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.product.name, "Test Silk Saree");
    assert.equal(body.product.variants.length, 1);
    assert.ok(body.product.variants[0].id);
  });

  it("404s for an unknown product slug", async () => {
    const res = await fetch(`${base}/api/products/does-not-exist`);
    assert.equal(res.status, 404);
  });

  it("lists collections", async () => {
    const res = await fetch(`${base}/api/collections`);
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.collections));
  });

  it("404s for an unknown collection slug", async () => {
    const res = await fetch(`${base}/api/collections/does-not-exist`);
    assert.equal(res.status, 404);
  });

  it("rejects a product update from an unauthenticated caller", async () => {
    const res = await fetch(`${base}/api/products/${seededProductId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...productInput, price: 11000 }),
    });
    assert.equal(res.status, 401);
  });

  it("rejects a product update from a non-admin customer", async () => {
    const res = await fetch(`${base}/api/products/${seededProductId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ ...productInput, price: 11000 }),
    });
    assert.equal(res.status, 403);
  });

  it("rejects an invalid update body", async () => {
    const res = await fetch(`${base}/api/products/${seededProductId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ ...productInput, price: -5 }),
    });
    assert.equal(res.status, 400);
  });

  it("lets an admin update a product (publish toggle + price edit)", async () => {
    const res = await fetch(`${base}/api/products/${seededProductId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ ...productInput, price: 11000, published: true }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.product.price, 11000);
    assert.equal(body.product.published, true);
  });

  it("404s when updating a product that doesn't exist", async () => {
    const res = await fetch(`${base}/api/products/000000000000000000000000`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(productInput),
    });
    assert.equal(res.status, 404);
  });
});
