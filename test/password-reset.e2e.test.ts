import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;
let server: Server;
let base: string;
let disconnectDb: () => Promise<void>;

const email = "reset-me@example.com";
const originalPassword = "correct-horse-1";

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
    firstName: "Reset",
    lastName: "Me",
    email,
    phone: "9876543210",
    passwordHash: await hashPassword(originalPassword),
    isEmailVerified: true,
    status: "active",
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
});

async function issueResetToken(): Promise<string> {
  const { PasswordResetToken, User } = await import("../src/modules/auth/models/index.js");
  const { generateOpaqueToken } = await import("../src/utils/random-token.js");
  const user = await User.findOne({ email });
  const { token, hash } = generateOpaqueToken();
  await PasswordResetToken.create({
    userId: user!._id,
    tokenHash: hash,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  return token;
}

describe("password reset (against a real MongoDB instance)", () => {
  it("always 204s on forgot-password, whether or not the email exists", async () => {
    const knownRes = await fetch(`${base}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    assert.equal(knownRes.status, 204);

    const unknownRes = await fetch(`${base}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com" }),
    });
    assert.equal(unknownRes.status, 204);
  });

  it("rejects reset with an invalid/unknown token", async () => {
    const res = await fetch(`${base}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "not-a-real-token", password: "new-password-1", confirmPassword: "new-password-1" }),
    });
    assert.equal(res.status, 401);
  });

  it("rejects a mismatched confirm-password", async () => {
    const token = await issueResetToken();
    const res = await fetch(`${base}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: "new-password-1", confirmPassword: "does-not-match" }),
    });
    assert.equal(res.status, 400);
  });

  it("resets the password with a valid token, and the token can't be reused", async () => {
    const token = await issueResetToken();
    const res = await fetch(`${base}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: "new-password-1", confirmPassword: "new-password-1" }),
    });
    assert.equal(res.status, 204);

    const reuseRes = await fetch(`${base}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: "another-password-1", confirmPassword: "another-password-1" }),
    });
    assert.equal(reuseRes.status, 401);
  });

  it("logs in with the new password, not the old one", async () => {
    const oldRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: originalPassword }),
    });
    assert.equal(oldRes.status, 401);

    const newRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "new-password-1" }),
    });
    assert.equal(newRes.status, 200);
  });

  it("revoked all prior sessions when the password was reset", async () => {
    // Log in (post-reset) to get a fresh refresh cookie, then simulate that
    // an *older* session (from before the reset) can no longer refresh.
    const { Session, User } = await import("../src/modules/auth/models/index.js");
    const { generateOpaqueToken } = await import("../src/utils/random-token.js");
    const user = await User.findOne({ email });
    const { token, hash } = generateOpaqueToken();
    await Session.create({
      userId: user!._id,
      refreshTokenHash: hash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    // Reset again to trigger the "revoke all sessions" side effect.
    const resetToken = await issueResetToken();
    await fetch(`${base}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, password: "third-password-1", confirmPassword: "third-password-1" }),
    });

    const refreshRes = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      // verifyCsrf only checks the two match each other, not against any
      // server-stored value — any self-consistent pair clears it so this
      // request reaches the actual (revoked-session) 401 being tested here.
      headers: { Cookie: `refreshToken=${token}; csrfToken=test-csrf`, "x-csrf-token": "test-csrf" },
    });
    assert.equal(refreshRes.status, 401);
  });
});
