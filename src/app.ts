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
import { exampleRouter } from "./modules/example.routes.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(morgan(env.isProduction ? "combined" : "dev"));
  app.use(express.json());
  app.use(cookieParser());

  // credentials: true is required for the httpOnly refresh cookie to be
  // sent/accepted cross-origin from the Vite frontend.
  app.use(cors({ origin: env.corsOrigin, credentials: true }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api", catalogRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api", couponsRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api", exampleRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
