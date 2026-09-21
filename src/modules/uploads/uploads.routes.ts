import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import * as uploadsController from "./uploads.controller.js";

// Memory storage keeps validation in control before the image is written to
// the appropriate folder under the backend's public directory.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype.startsWith("image/"));
  },
});

export const uploadsRouter = Router();

uploadsRouter.post(
  "/",
  authenticate,
  authorize("admin"),
  upload.single("image"),
  uploadsController.upload,
);
