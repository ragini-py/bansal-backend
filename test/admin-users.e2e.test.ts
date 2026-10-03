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
let adminId: string;
let customerId: string;

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
  const customer = await User.create({
    email: "admin-users-customer@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Cat",
    lastName: "Customer",
    phone: "9876543210",
  });
  customerId = customer._id.toString();
  const admin = await User.create({
    email: "admin-users-admin@example.com",
    passwordHash: await hashPassword("correct-horse-1"),
    firstName: "Ops",
    lastName: "Admin",
    phone: "9876543210",
    role: "admin",
  });
  adminId = admin._id.toString();

  async function login(email: string): Promise<string> {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "correct-horse-1" }),
    });
    const body = await readJson(res);
    return body.accessToken;
  }
  customerToken = await login("admin-users-customer@example.com");
  adminToken = await login("admin-users-admin@example.com");
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
});

describe("admin user management (against a real MongoDB instance)", () => {
  it("rejects listing users from an unauthenticated caller", async () => {
    const res = await fetch(`${base}/api/users`);
    assert.equal(res.status, 401);
  });

  it("rejects listing users from a non-admin customer", async () => {
    const res = await fetch(`${base}/api/users`, { headers: { Authorization: `Bearer ${customerToken}` } });
    assert.equal(res.status, 403);
  });

  it("lets an admin list all users", async () => {
    const res = await fetch(`${base}/api/users`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.users.length, 2);
    assert.ok(!("passwordHash" in body.users[0]));
  });

  it("rejects a non-admin promoting themselves", async () => {
    const res = await fetch(`${base}/api/users/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({ role: "admin" }),
    });
    assert.equal(res.status, 403);
  });

  it("blocks an admin from changing their own role/status", async () => {
    const res = await fetch(`${base}/api/users/${adminId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "blocked" }),
    });
    assert.equal(res.status, 403);
  });

  it("rejects an invalid patch body", async () => {
    const res = await fetch(`${base}/api/users/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ role: "superadmin" }),
    });
    assert.equal(res.status, 400);
  });

  it("lets an admin promote a customer to admin, and revokes affected user sessions while keeping unrelated sessions active", async () => {
    const { Session } = await import("../src/modules/auth/models/index.js");

    // Login customer to create an active session
    const customerLoginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin-users-customer@example.com", password: "correct-horse-1" }),
    });
    assert.equal(customerLoginRes.status, 200);

    const customerSessionsBefore = await Session.find({ userId: customerId, revokedAt: null });
    const adminSessionsBefore = await Session.find({ userId: adminId, revokedAt: null });
    assert.ok(customerSessionsBefore.length > 0);
    assert.ok(adminSessionsBefore.length > 0);

    // Promote customer to admin (role changes from customer -> admin)
    const res = await fetch(`${base}/api/users/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ role: "admin" }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.user.role, "admin");

    // Affected user's active sessions are revoked
    const customerSessionsAfter = await Session.find({ userId: customerId, revokedAt: null });
    assert.equal(customerSessionsAfter.length, 0);

    // Unrelated admin's sessions remain active
    const adminSessionsAfter = await Session.find({ userId: adminId, revokedAt: null });
    assert.equal(adminSessionsAfter.length, adminSessionsBefore.length);
  });

  it("does not unnecessarily revoke sessions when the role is unchanged", async () => {
    const { Session } = await import("../src/modules/auth/models/index.js");

    // Customer logs in after being promoted
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin-users-customer@example.com", password: "correct-horse-1" }),
    });
    assert.equal(loginRes.status, 200);

    const sessionsBefore = await Session.find({ userId: customerId, revokedAt: null });
    assert.ok(sessionsBefore.length > 0);

    // Send PATCH with the SAME role ("admin" -> "admin")
    const res = await fetch(`${base}/api/users/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ role: "admin" }),
    });
    assert.equal(res.status, 200);

    // Sessions are NOT revoked
    const sessionsAfter = await Session.find({ userId: customerId, revokedAt: null });
    assert.equal(sessionsAfter.length, sessionsBefore.length);
  });

  it("lets an admin block a customer, revoking active sessions without affecting unrelated users", async () => {
    const { Session } = await import("../src/modules/auth/models/index.js");

    const adminSessionsBefore = await Session.find({ userId: adminId, revokedAt: null });
    assert.ok(adminSessionsBefore.length > 0);

    const res = await fetch(`${base}/api/users/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "blocked" }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.user.status, "blocked");

    // Blocked user active sessions revoked
    const customerSessionsAfter = await Session.find({ userId: customerId, revokedAt: null });
    assert.equal(customerSessionsAfter.length, 0);

    // Unrelated admin sessions remain active
    const adminSessionsAfter = await Session.find({ userId: adminId, revokedAt: null });
    assert.equal(adminSessionsAfter.length, adminSessionsBefore.length);

    // Blocked account cannot log in
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin-users-customer@example.com", password: "correct-horse-1" }),
    });
    assert.equal(loginRes.status, 403);
  });

  it("404s patching a user that doesn't exist", async () => {
    const res = await fetch(`${base}/api/users/000000000000000000000000`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status: "active" }),
    });
    assert.equal(res.status, 404);
  });
});
