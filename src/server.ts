import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDb, disconnectDb } from "./db/connect.js";

async function bootstrap(): Promise<void> {
  await connectDb();
  console.log("Connected to MongoDB");

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Server listening on ${env.appUrl}`);
    console.log(`Health check: ${env.appUrl}/api/health`);
  });

  // Stop accepting new connections, let in-flight requests finish, then
  // close the DB connection — in that order, so a request already in a
  // service call doesn't have its Mongo connection yanked out from under it.
  // Orchestrators (Docker, Kubernetes, most PaaS) send SIGTERM before
  // killing a container; without this the process would die mid-request.
  let shuttingDown = false;
  function shutdown(signal: string): void {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received, shutting down gracefully...`);
    server.close(() => {
      disconnectDb()
        .catch((err: unknown) => console.error("Error closing MongoDB connection:", err))
        .finally(() => process.exit(0));
    });
    // Don't hang forever if a connection refuses to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

bootstrap().catch((err: unknown) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
