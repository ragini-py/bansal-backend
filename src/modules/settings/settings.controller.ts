import type { Request, Response } from "express";
import { requestMeta } from "../../common/request-meta.js";
import type { AccessTokenPayload } from "../../utils/jwt.js";
import * as settingsService from "./settings.service.js";
import type { UpdateSettingsInput } from "./settings.schemas.js";

export async function get(_req: Request, res: Response): Promise<void> {
  const settings = await settingsService.getSettings();
  res.json({ settings });
}

export async function update(req: Request, res: Response): Promise<void> {
  const { sub } = req.user as AccessTokenPayload;
  const settings = await settingsService.updateSettings(req.body as UpdateSettingsInput, {
    id: sub,
    ...requestMeta(req),
  });
  res.json({ settings });
}
