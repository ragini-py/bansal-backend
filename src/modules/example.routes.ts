import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";

// Reference examples for the two access-control layers, and a template for
// future admin-only routes (products/orders/coupons management). Safe to
// delete once real protected routes exist elsewhere.
export const exampleRouter = Router();

exampleRouter.get("/protected/ping", authenticate, (req, res) => {
  res.json({ message: `Hello ${req.user?.email}, your access token is valid.` });
});

exampleRouter.get("/protected/admin-ping", authenticate, authorize("admin"), (_req, res) => {
  res.json({ message: "Hello admin — role-based access control passed." });
});
