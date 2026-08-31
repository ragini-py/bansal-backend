import path from "node:path";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";
import { catalogRouter } from "./modules/catalog/catalog.routes.js";
import { ordersRouter } from "./modules/orders/orders.routes.js";
import { couponsRouter } from "./modules/coupons/coupons.routes.js";
import { cartRouter } from "./modules/cart/cart.routes.js";
import { uploadsRouter } from "./modules/uploads/uploads.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { contentRouter } from "./modules/content/content.routes.js";
import { wishlistRouter } from "./modules/wishlist/wishlist.routes.js";
import { exampleRouter } from "./modules/example.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { sanitizeMongo } from "./middleware/sanitize-mongo.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(morgan(env.isProduction ? "combined" : "dev"));
  app.use(express.json());
  app.use(cookieParser());
  app.use(sanitizeMongo);

  // credentials: true is required for the httpOnly refresh cookie to be
  // sent/accepted cross-origin from the Vite frontend. origin is a function
  // over an allowlist (env.corsOrigins, comma-separated in CORS_ORIGIN)
  // rather than a single fixed string, so staging/prod can each be added
  // without a code change.
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || env.corsOrigins.includes(origin)) callback(null, true);
        else callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Bare-path alias for load balancers/orchestrators that probe /healthz by
  // convention rather than the API's own /api/health.
  app.get("/healthz", (_req, res) => {
    res.status(200).send("ok");
  });

  // Local-disk upload fallback (see modules/uploads/uploads.service.ts) —
  // served cross-origin since the frontend runs on a different port.
  // Helmet's default same-origin resource policy would otherwise block the
  // frontend from loading these images.
  app.use(
    "/uploads",
    (_req, res, next) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    },
    express.static(path.join(process.cwd(), "uploads")),
  );

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api", catalogRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api", couponsRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/content", contentRouter);
  app.use("/api/wishlist", wishlistRouter);
  app.use("/api", exampleRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
