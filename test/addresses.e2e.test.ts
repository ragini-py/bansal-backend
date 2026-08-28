import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;
let server: Server;
let base: string;
let disconnectDb: () => Promise<void>;
let accessToken: string;

function readJson(res: Response): Promise<any> {
  return res.json();
}

const address = {
  label: "Home",
  fullName: "Priya Sharma",
  phone: "9876543210",
  line1: "221B Baker Street",
  locality: "Ballygunge",
  city: "Kolkata",
  state: "West Bengal",
  pincode: "700019",
  country: "India",
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

  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firstName: "Priya",
      lastName: "Sharma",
      email: "priya-addr@example.com",
      phone: "9876543210",
      password: "correct-horse-1",
    }),
  });
  const body = await readJson(res);
  accessToken = body.accessToken;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
});

describe("address management (against a real MongoDB instance)", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await fetch(`${base}/api/users/me/addresses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(address),
    });
    assert.equal(res.status, 401);
  });

  it("rejects an invalid address body", async () => {
    const res = await fetch(`${base}/api/users/me/addresses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ label: "Home" }),
    });
    assert.equal(res.status, 400);
  });

  it("the first address added is always the default", async () => {
    const res = await fetch(`${base}/api/users/me/addresses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(address),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.equal(body.user.addresses.length, 1);
    assert.equal(body.user.addresses[0].isDefault, true);
    assert.equal(body.user.addresses[0].city, "Kolkata");
  });

  it("adding a second, non-default address leaves the first as default", async () => {
    const res = await fetch(`${base}/api/users/me/addresses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ...address, label: "Office", city: "Mumbai" }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.equal(body.user.addresses.length, 2);
    assert.equal(body.user.addresses.filter((a: { isDefault: boolean }) => a.isDefault).length, 1);
    assert.equal(body.user.addresses[0].isDefault, true);
  });

  it("marking a new address default demotes the previous default", async () => {
    const res = await fetch(`${base}/api/users/me/addresses`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ...address, label: "Weekend home", city: "Pune", isDefault: true }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.equal(body.user.addresses.length, 3);
    const defaults = body.user.addresses.filter((a: { isDefault: boolean }) => a.isDefault);
    assert.equal(defaults.length, 1);
    assert.equal(defaults[0].city, "Pune");
  });

  it("removing the default address promotes another one to default", async () => {
    const meRes = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const meBody = await readJson(meRes);
    const currentDefault = meBody.user.addresses.find((a: { isDefault: boolean }) => a.isDefault);

    const res = await fetch(`${base}/api/users/me/addresses/${currentDefault.id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.equal(body.user.addresses.length, 2);
    assert.equal(body.user.addresses.filter((a: { isDefault: boolean }) => a.isDefault).length, 1);
  });

  it("404s when removing an address that doesn't exist", async () => {
    const res = await fetch(`${base}/api/users/me/addresses/000000000000000000000000`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    assert.equal(res.status, 404);
  });
});
