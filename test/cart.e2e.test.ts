import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;
let server: Server;
let base: string;
let disconnectDb: () => Promise<void>;
let tokenA: string;
let tokenB: string;

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

  async function registerAndLogin(email: string): Promise<string> {
    const res = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Cart", lastName: "User", email, phone: "9876543210", password: "correct-horse-1" }),
    });
    const body = await readJson(res);
    return body.accessToken;
  }
  tokenA = await registerAndLogin("cart-a@example.com");
  tokenB = await registerAndLogin("cart-b@example.com");
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
});

describe("cart (against a real MongoDB instance)", () => {
  it("rejects access from an unauthenticated caller", async () => {
    const res = await fetch(`${base}/api/cart`);
    assert.equal(res.status, 401);
  });

  it("returns an empty cart for a user who has never saved one", async () => {
    const res = await fetch(`${base}/api/cart`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.deepEqual(body.lines, []);
  });

  it("rejects an invalid cart body", async () => {
    const res = await fetch(`${base}/api/cart`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ lines: [{ productId: "p1" }] }),
    });
    assert.equal(res.status, 400);
  });

  it("replaces the cart and returns it on the next GET", async () => {
    const lines = [
      { productId: "p1", variantId: "p1-gold-m", size: "M", colour: "Gold", quantity: 2 },
    ];
    const putRes = await fetch(`${base}/api/cart`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ lines }),
    });
    const putBody = await readJson(putRes);
    assert.equal(putRes.status, 200);
    assert.deepEqual(putBody.lines, lines);

    const getRes = await fetch(`${base}/api/cart`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const getBody = await readJson(getRes);
    assert.deepEqual(getBody.lines, lines);
  });

  it("a full PUT overwrites the previous cart rather than merging", async () => {
    const newLines = [
      { productId: "p2", variantId: "p2-blush-s", size: "S", colour: "Blush", quantity: 1 },
    ];
    await fetch(`${base}/api/cart`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ lines: newLines }),
    });
    const res = await fetch(`${base}/api/cart`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const body = await readJson(res);
    assert.deepEqual(body.lines, newLines);
  });

  it("carts are isolated per user", async () => {
    const res = await fetch(`${base}/api/cart`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const body = await readJson(res);
    assert.deepEqual(body.lines, []);
  });

  it("an empty PUT clears the cart", async () => {
    const res = await fetch(`${base}/api/cart`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ lines: [] }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.deepEqual(body.lines, []);
  });
});
