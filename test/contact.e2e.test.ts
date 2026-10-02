import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { Server } from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongod: MongoMemoryServer;
let server: Server;
let base: string;
let disconnectDb: () => Promise<void>;

before(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.NODE_ENV = "test";
    process.env.MONGODB_URI = mongod.getUri();
    process.env.CORS_ORIGIN = "http://localhost:5173";
    process.env.JWT_ACCESS_SECRET = "test-secret-test-secret-test-secret-test-secret";
    process.env.APP_URL = "http://localhost:4000";
    process.env.SMTP_HOST = "";
    process.env.SMTP_USER = "";
    process.env.SMTP_PASS = "";

    const { createApp } = await import("../src/app.js");
    const { connectDb, disconnectDb: disconnect } = await import("../src/db/connect.js");
    disconnectDb = disconnect;

    await connectDb();
    server = createApp().listen(0);
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const addr = server.address();
    const port = typeof addr === "object" && addr ? addr.port : 0;
    base = `http://localhost:${port}`;
});

after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await disconnectDb();
    await mongod.stop();
});

describe("public contact form", () => {
    it("validates guest submissions without requiring authentication", async () => {
        const res = await fetch(`${base}/api/contact`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Guest", email: "invalid", subject: "Help", message: "Need help please" }),
        });
        assert.equal(res.status, 400);
    });

    it("does not claim delivery when SMTP is not configured", async () => {
        const res = await fetch(`${base}/api/contact`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Guest",
                email: "guest@example.com",
                subject: "Order question",
                message: "Please help me with my order.",
            }),
        });
        assert.equal(res.status, 503);
    });
});