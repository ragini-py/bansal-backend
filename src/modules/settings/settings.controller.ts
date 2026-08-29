import type { Request, Response } from "express";
import * as settingsService from "./settings.service.js";
import type { UpdateSettingsInput } from "./settings.schemas.js";

export async function get(_req: Request, res: Response): Promise<void> {
  const settings = await settingsService.getSettings();
  res.json({ settings });
}

export async function update(req: Request, res: Response): Promise<void> {
  const settings = await settingsService.updateSettings(req.body as UpdateSettingsInput);
  res.json({ settings });
}
