import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { rm } from "node:fs/promises";
import path from "node:path";
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

function tinyPngBlob(): Blob {
  // Smallest valid 1x1 transparent PNG.
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const bytes = Buffer.from(base64, "base64");
  return new Blob([bytes], { type: "image/png" });
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
    email: "uploads-customer@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Cat",
    lastName: "Customer",
    phone: "9876543210",
    isEmailVerified: true,
  });
  await User.create({
    email: "uploads-admin@example.com",
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
  customerToken = await login("uploads-customer@example.com");
  adminToken = await login("uploads-admin@example.com");
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
  await rm(path.join(process.cwd(), "public", "images"), { recursive: true, force: true });
});

describe("uploads (local public storage)", () => {
  it("rejects an unauthenticated upload", async () => {
    const form = new FormData();
    form.append("image", tinyPngBlob(), "test.png");
    form.append("folder", "products");
    const res = await fetch(`${base}/api/uploads`, { method: "POST", body: form });
    assert.equal(res.status, 401);
  });

  it("rejects an upload from a non-admin customer", async () => {
    const form = new FormData();
    form.append("image", tinyPngBlob(), "test.png");
    const res = await fetch(`${base}/api/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${customerToken}` },
      body: form,
    });
    assert.equal(res.status, 403);
  });

  it("rejects a request with no file", async () => {
    const form = new FormData();
    const res = await fetch(`${base}/api/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    assert.equal(res.status, 400);
  });

  it("rejects a file whose declared mimetype lies about its actual bytes", async () => {
    // multer's fileFilter only checks the client-declared mimetype (spoofed
    // to image/png here) — the magic-byte check in uploads.controller.ts is
    // what has to catch that this is plain text, not a real PNG.
    const fakeBlob = new Blob([Buffer.from("<?php echo 'not an image'; ?>")], { type: "image/png" });
    const form = new FormData();
    form.append("image", fakeBlob, "malicious.png");
    const res = await fetch(`${base}/api/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    assert.equal(res.status, 400);
  });

  it("lets an admin upload an image and returns a fetchable local URL", async () => {
    const form = new FormData();
    form.append("image", tinyPngBlob(), "test.png");
    form.append("folder", "products");
    const res = await fetch(`${base}/api/uploads`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: form,
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.ok(body.url.startsWith("/images/products/"));

    const fileRes = await fetch(`${base}${body.url}`);
    assert.equal(fileRes.status, 200);
    assert.equal(fileRes.headers.get("cross-origin-resource-policy"), "cross-origin");
  });
});
