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
    email: "content-customer@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Cat",
    lastName: "Customer",
    phone: "9876543210",
    isEmailVerified: true,
  });
  await User.create({
    email: "content-admin@example.com",
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
  customerToken = await login("content-customer@example.com");
  adminToken = await login("content-admin@example.com");
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
});

describe("content (against a real MongoDB instance)", () => {
  it("returns default homepage content publicly, without auth, creating the singleton lazily", async () => {
    const res = await fetch(`${base}/api/content`);
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.content.hero.heading, "An heirloom in the making");
    assert.deepEqual(body.content.featuredCollectionIds, [
      "the-ceremony-edit",
      "quiet-hours",
      "heritage-classics",
    ]);
    assert.equal(body.content.sections.length, 8);
  });

  it("rejects an update from an unauthenticated caller", async () => {
    const res = await fetch(`${base}/api/content`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ announcement: { enabled: false, text: "" } }),
    });
    assert.equal(res.status, 401);
  });

  it("rejects an update from a non-admin customer", async () => {
    const res = await fetch(`${base}/api/content`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ announcement: { enabled: false, text: "" } }),
    });
    assert.equal(res.status, 403);
  });

  it("rejects an invalid update body", async () => {
    const res = await fetch(`${base}/api/content`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ hero: { eyebrow: "x" } }),
    });
    assert.equal(res.status, 400);
  });

  it("lets an admin update the announcement, hero, and featured picks, visible on the next public GET", async () => {
    const res = await fetch(`${base}/api/content`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        announcement: { enabled: false, text: "Sale ends tonight" },
        hero: {
          eyebrow: "New",
          heading: "Updated Heading",
          subheading: "Updated subheading",
          primaryCta: "SHOP",
          secondaryCta: "EXPLORE",
        },
        featuredProductIds: ["a", "b"],
      }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.content.announcement.enabled, false);
    assert.equal(body.content.hero.heading, "Updated Heading");
    assert.deepEqual(body.content.featuredProductIds, ["a", "b"]);
    // Untouched fields survive the partial update.
    assert.equal(body.content.editorial.heading, "CRAFTED FOR THE EXTRAORDINARY YOU");

    const getRes = await fetch(`${base}/api/content`);
    const getBody = await readJson(getRes);
    assert.equal(getBody.content.hero.heading, "Updated Heading");
  });

  it("lets an admin toggle section visibility", async () => {
    const res = await fetch(`${base}/api/content`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        sections: [{ key: "newsletter", label: "Newsletter", visible: false }],
      }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.deepEqual(body.content.sections, [
      { key: "newsletter", label: "Newsletter", visible: false },
    ]);
  });
});
