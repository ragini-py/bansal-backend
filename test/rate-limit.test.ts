import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import express from "express";
import { limiter } from "../src/middleware/rate-limit.js";

// Isolated from auth.e2e.test.ts on purpose: its own tiny Express app with
// its own explicit small limit, so this can actually exhaust the limiter
// and assert a 429 without interfering with (or being interfered by) the
// many functional login/register calls in the auth suite.
let server: Server;
let base: string;

before(async () => {
  const app = express();
  app.post("/limited", limiter(3, 60_000, "Too many requests."), (_req, res) => {
    res.json({ ok: true });
  });

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  base = `http://localhost:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("rate-limit middleware", () => {
  it("allows requests under the limit, then blocks with 429", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${base}/limited`, { method: "POST" });
      statuses.push(res.status);
    }
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  });

  it("429 response carries the configured message", async () => {
    const res = await fetch(`${base}/limited`, { method: "POST" });
    const body = (await res.json()) as { code: string; message: string };
    assert.equal(res.status, 429);
    assert.equal(body.code, "RATE_LIMITED");
    assert.equal(body.message, "Too many requests.");
  });
});
