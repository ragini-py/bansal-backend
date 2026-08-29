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

function readJson(res: Response): Promise<any> {
  return res.json();
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
    email: "settings-customer@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Cat",
    lastName: "Customer",
    phone: "9876543210",
  });
  await User.create({
    email: "settings-admin@example.com",
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
  customerToken = await login("settings-customer@example.com");
  adminToken = await login("settings-admin@example.com");
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
});

describe("settings (against a real MongoDB instance)", () => {
  it("returns default settings publicly, without auth, creating the singleton lazily", async () => {
    const res = await fetch(`${base}/api/settings`);
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.settings.brandName, "Bansal-nx");
    assert.equal(body.settings.freeShippingThreshold, 25000);
    // Not configured in this test env, so this must reflect that truthfully.
    assert.equal(body.settings.emailProviderConnected, false);
  });

  it("rejects an update from an unauthenticated caller", async () => {
    const res = await fetch(`${base}/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shippingFee: 500 }),
    });
    assert.equal(res.status, 401);
  });

  it("rejects an update from a non-admin customer", async () => {
    const res = await fetch(`${base}/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ shippingFee: 500 }),
    });
    assert.equal(res.status, 403);
  });

  it("rejects an invalid update body", async () => {
    const res = await fetch(`${base}/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ shippingFee: -5 }),
    });
    assert.equal(res.status, 400);
  });

  it("lets an admin update shipping settings, and the change is visible on the next public GET", async () => {
    const res = await fetch(`${base}/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ freeShippingThreshold: 10000, shippingFee: 199, codMaxOrderValue: 30000 }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.settings.freeShippingThreshold, 10000);
    assert.equal(body.settings.shippingFee, 199);
    assert.equal(body.settings.codMaxOrderValue, 30000);

    const getRes = await fetch(`${base}/api/settings`);
    const getBody = await readJson(getRes);
    assert.equal(getBody.settings.freeShippingThreshold, 10000);
  });

  it("ignores fields outside the admin-editable set (brandName is read-only via this endpoint)", async () => {
    const res = await fetch(`${base}/api/settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ brandName: "Hacked Brand", shippingFee: 250 }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.settings.shippingFee, 250);
    assert.equal(body.settings.brandName, "Bansal-nx");
  });
});
