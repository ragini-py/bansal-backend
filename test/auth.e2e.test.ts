import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;
let server: Server;
let base: string;
let disconnectDb: () => Promise<void>;

function extractRefreshCookie(res: Response): string | undefined {
  const raw = res.headers.getSetCookie?.() ?? [];
  const rt = raw.find((c) => c.startsWith("refreshToken="));
  return rt?.split(";")[0];
}

// verify-csrf.ts only checks that the cookie and header match each other,
// not against any server-stored value — so a request just needs to carry
// both, self-consistent, for the double-submit check to pass.
function csrfHeaders(refreshCookie: string, csrfToken: string): Record<string, string> {
  return { Cookie: `${refreshCookie}; csrfToken=${csrfToken}`, "x-csrf-token": csrfToken };
}

// Test-only convenience — response bodies here are our own API's JSON.
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
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  base = `http://localhost:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await disconnectDb();
  await mongod.stop();
});

describe("auth flow (against a real MongoDB instance)", () => {
  const email = "priya@example.com";
  const password = "correct-horse-1";
  let refreshCookie: string;
  let csrfToken: string;

  it("registers a new user and immediately signs them in", async () => {
    const res = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Priya", lastName: "Sharma", email, phone: "9876543210", password }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 201);
    assert.equal(body.user.email, email);
    assert.equal(body.user.role, "customer");
    assert.equal(body.user.status, "active");
    assert.deepEqual(body.user.addresses, []);
    assert.equal("password" in body.user, false);
    assert.equal("passwordHash" in body.user, false);
    assert.ok(body.accessToken);
    assert.ok(body.csrfToken);
    assert.ok(extractRefreshCookie(res));
  });

  it("rejects a duplicate registration", async () => {
    const res = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstName: "Priya", lastName: "Sharma", email, phone: "9876543210", password }),
    });
    assert.equal(res.status, 409);
  });

  it("rejects an invalid registration body", async () => {
    const res = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email", password: "short" }),
    });
    assert.equal(res.status, 400);
  });

  it("logs in with correct credentials, sets the refresh cookie", async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.ok(body.accessToken);
    assert.ok(body.csrfToken);
    const cookie = extractRefreshCookie(res);
    assert.ok(cookie);
    refreshCookie = cookie;
    csrfToken = body.csrfToken;
  });

  it("rejects the wrong password", async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "totally-wrong" }),
    });
    assert.equal(res.status, 401);
  });

  it("rejects a login for an email that was never registered", async () => {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "whatever1" }),
    });
    assert.equal(res.status, 401);
  });

  it("/me returns the current user with a valid access token, 401 without", async () => {
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const { accessToken } = await readJson(loginRes);

    const meRes = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
    const meBody = await readJson(meRes);
    assert.equal(meRes.status, 200);
    assert.equal(meBody.user.email, email);

    const noTokenRes = await fetch(`${base}/api/auth/me`);
    assert.equal(noTokenRes.status, 401);

    const badTokenRes = await fetch(`${base}/api/auth/me`, { headers: { Authorization: "Bearer not.a.valid.token" } });
    assert.equal(badTokenRes.status, 401);
  });

  it("role-based access control: customer blocked from admin route, admin allowed", async () => {
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const { accessToken: customerToken } = await readJson(loginRes);

    const blockedRes = await fetch(`${base}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${customerToken}` },
    });
    assert.equal(blockedRes.status, 403);

    // Promote the user to admin directly in the DB (no admin-creation
    // endpoint exists yet — that's a deliberate future increment, not an
    // oversight), then confirm a fresh token reflects it.
    const { User } = await import("../src/modules/auth/models/index.js");
    await User.updateOne({ email }, { role: "admin" });

    const reLoginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const { accessToken: adminToken } = await readJson(reLoginRes);

    const allowedRes = await fetch(`${base}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.equal(allowedRes.status, 200);

    await User.updateOne({ email }, { role: "customer" });
  });

  it("rejects refresh/logout with a missing or mismatched CSRF token", async () => {
    // Cookie present, no x-csrf-token header at all.
    const noHeaderRes = await fetch(`${base}/api/auth/refresh`, { method: "POST", headers: { Cookie: refreshCookie } });
    assert.equal(noHeaderRes.status, 403);

    // Header present but doesn't match the cookie.
    const mismatchRes = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: { Cookie: `${refreshCookie}; csrfToken=${csrfToken}`, "x-csrf-token": "not-the-right-value" },
    });
    assert.equal(mismatchRes.status, 403);

    const logoutMismatchRes = await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: `${refreshCookie}; csrfToken=${csrfToken}`, "x-csrf-token": "not-the-right-value" },
    });
    assert.equal(logoutMismatchRes.status, 403);
  });

  it("rotates the refresh token and invalidates the previous one", async () => {
    const res = await fetch(`${base}/api/auth/refresh`, { method: "POST", headers: csrfHeaders(refreshCookie, csrfToken) });
    const body = await readJson(res);
    assert.equal(res.status, 200);
    assert.ok(body.accessToken);
    assert.ok(body.csrfToken);

    const rotatedCookie = extractRefreshCookie(res);
    assert.ok(rotatedCookie);
    assert.notEqual(rotatedCookie, refreshCookie);

    const reuseRes = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: csrfHeaders(refreshCookie, csrfToken),
    });
    assert.equal(reuseRes.status, 401);

    refreshCookie = rotatedCookie;
    csrfToken = body.csrfToken;
  });

  it("rejects refresh with no cookie at all", async () => {
    const res = await fetch(`${base}/api/auth/refresh`, { method: "POST" });
    assert.equal(res.status, 401);
  });

  it("logs out and actually revokes the session (not just the cookie)", async () => {
    const logoutRes = await fetch(`${base}/api/auth/logout`, {
      method: "POST",
      headers: csrfHeaders(refreshCookie, csrfToken),
    });
    assert.equal(logoutRes.status, 204);
    const setCookie = logoutRes.headers.get("set-cookie") || "";
    assert.ok(setCookie.includes("Path=/api/auth"));

    const refreshAfterLogoutRes = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: csrfHeaders(refreshCookie, csrfToken),
    });
    assert.equal(refreshAfterLogoutRes.status, 401);
  });

  it("suspended accounts are blocked from logging in", async () => {
    const { User } = await import("../src/modules/auth/models/index.js");
    await User.updateOne({ email }, { status: "blocked" });

    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(res.status, 403);

    await User.updateOne({ email }, { status: "active" });
  });

  it("blocked accounts cannot refresh their session, and the session is revoked", async () => {
    const loginRes = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    assert.equal(loginRes.status, 200);
    const loginBody = await readJson(loginRes);
    const activeRefreshCookie = extractRefreshCookie(loginRes);
    assert.ok(activeRefreshCookie);

    const { User, Session } = await import("../src/modules/auth/models/index.js");
    await User.updateOne({ email }, { status: "blocked" });

    const refreshRes = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: csrfHeaders(activeRefreshCookie!, loginBody.csrfToken),
    });
    assert.equal(refreshRes.status, 403);
    const refreshBody = await readJson(refreshRes);
    assert.equal(refreshBody.code, "FORBIDDEN");

    const blockedUser = await User.findOne({ email });
    const liveSessions = await Session.find({ userId: blockedUser!._id, revokedAt: null });
    assert.equal(liveSessions.length, 0);

    await User.updateOne({ email }, { status: "active" });
  });

  it("reusing an already-rotated refresh token revokes the whole session family", async () => {
    const reuseEmail = "arjun@example.com";
    const reusePassword = "correct-horse-2";

    const registerRes = await fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Arjun",
        lastName: "Rao",
        email: reuseEmail,
        phone: "9876500000",
        password: reusePassword,
      }),
    });
    const registerBody = await readJson(registerRes);
    const stolenCookie = extractRefreshCookie(registerRes);
    assert.ok(stolenCookie);

    // Legit rotation: the real client uses the token once.
    const rotateRes = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: csrfHeaders(stolenCookie!, registerBody.csrfToken),
    });
    assert.equal(rotateRes.status, 200);
    const rotateBody = await readJson(rotateRes);
    const currentCookie = extractRefreshCookie(rotateRes);
    assert.ok(currentCookie);

    // Attacker replays the now-rotated token — rejected, and this must also
    // kill the legitimate session that replaced it, not just this request.
    const replayRes = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: csrfHeaders(stolenCookie!, registerBody.csrfToken),
    });
    assert.equal(replayRes.status, 401);

    const legitFollowUpRes = await fetch(`${base}/api/auth/refresh`, {
      method: "POST",
      headers: csrfHeaders(currentCookie!, rotateBody.csrfToken),
    });
    assert.equal(legitFollowUpRes.status, 401);
  });

  it("login route has rate-limit headers wired up", async () => {
    // The limiter's actual "trips after N requests" behavior is tested in
    // isolation in rate-limit.test.ts — this suite's limit is deliberately
    // raised in test env (see config/env.ts) so the many functional login
    // calls above don't trip each other's shared budget. This just confirms
    // the middleware is actually mounted on the route.
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "wrong" }),
    });
    assert.ok(res.headers.get("ratelimit-limit"));
  });
});
