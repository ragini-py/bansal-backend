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
      body: JSON.stringify({ firstName: "Wish", lastName: "User", email, phone: "9876543210", password: "correct-horse-1" }),
    });
    const body = await readJson(res);
    return body.accessToken;
  }
  tokenA = await registerAndLogin("wishlist-a@example.com");
  tokenB = await registerAndLogin("wishlist-b@example.com");
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
});

describe("wishlist (against a real MongoDB instance)", () => {
  it("rejects access from an unauthenticated caller", async () => {
    const res = await fetch(`${base}/api/wishlist`);
    assert.equal(res.status, 401);
  });

  it("returns an empty wishlist for a user who has never saved one", async () => {
    const res = await fetch(`${base}/api/wishlist`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.deepEqual(body.productIds, []);
  });

  it("rejects an invalid body", async () => {
    const res = await fetch(`${base}/api/wishlist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ productIds: [123] }),
    });
    assert.equal(res.status, 400);
  });

  it("replaces the wishlist and returns it on the next GET", async () => {
    const putRes = await fetch(`${base}/api/wishlist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ productIds: ["p1", "p2"] }),
    });
    const putBody = await readJson(putRes);
    assert.equal(putRes.status, 200);
    assert.deepEqual(putBody.productIds, ["p1", "p2"]);

    const getRes = await fetch(`${base}/api/wishlist`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const getBody = await readJson(getRes);
    assert.deepEqual(getBody.productIds, ["p1", "p2"]);
  });

  it("wishlists are isolated per user", async () => {
    const res = await fetch(`${base}/api/wishlist`, { headers: { Authorization: `Bearer ${tokenB}` } });
    const body = await readJson(res);
    assert.deepEqual(body.productIds, []);
  });

  it("a full PUT overwrites rather than merging", async () => {
    const res = await fetch(`${base}/api/wishlist`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ productIds: ["p3"] }),
    });
    const body = await readJson(res);
    assert.deepEqual(body.productIds, ["p3"]);
  });

  it("atomically adds and removes products via POST and DELETE without overwriting", async () => {
    // Add p4
    const postRes = await fetch(`${base}/api/wishlist/p4`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const postBody = await readJson(postRes);
    assert.equal(postRes.status, 200);
    assert.ok(postBody.productIds.includes("p3"));
    assert.ok(postBody.productIds.includes("p4"));

    // Adding duplicate p4 does not duplicate
    const postDupRes = await fetch(`${base}/api/wishlist/p4`, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const postDupBody = await readJson(postDupRes);
    assert.equal(postDupRes.status, 200);
    assert.equal(postDupBody.productIds.filter((id: string) => id === "p4").length, 1);

    // Delete p3
    const delRes = await fetch(`${base}/api/wishlist/p3`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const delBody = await readJson(delRes);
    assert.equal(delRes.status, 200);
    assert.deepEqual(delBody.productIds, ["p4"]);
  });
});
