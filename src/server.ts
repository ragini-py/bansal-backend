import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDb } from "./db/connect.js";

async function bootstrap(): Promise<void> {
  await connectDb();
  console.log("Connected to MongoDB");

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Server listening on ${env.appUrl}`);
    console.log(`Health check: ${env.appUrl}/api/health`);
  });
}

bootstrap().catch((err: unknown) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
